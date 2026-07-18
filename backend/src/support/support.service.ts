import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationType, TicketPriority, TicketStatus } from '@wavehub/shared-types';
import type { AdminTicketSummary, PublicSavedReply, PublicTicket, PublicTicketMessage } from '@wavehub/shared-types';
import { Ticket } from './ticket.entity';
import { TicketMessage } from './ticket-message.entity';
import { SavedReply } from './saved-reply.entity';
import { Order } from '../orders/order.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    @InjectRepository(Ticket) private readonly tickets: Repository<Ticket>,
    @InjectRepository(TicketMessage) private readonly messages: Repository<TicketMessage>,
    @InjectRepository(SavedReply) private readonly savedReplies: Repository<SavedReply>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly notifications: NotificationsService,
  ) {}

  // Best-effort — a notification failure must never block a reply or status change, same pattern
  // as every other module's private `notify` helper (see orders/chat/disputes/withdrawals).
  private async notify(userId: string, title: string, body: string, ticketId: string): Promise<void> {
    try {
      await this.notifications.emit(userId, NotificationType.TicketReplied, title, body, { ticketId });
    } catch (err) {
      this.logger.error(`Failed to notify user ${userId} for ticket ${ticketId}`, err as Error);
    }
  }

  // Requester opens a new ticket — the description becomes the ticket's first message so the
  // thread view (getMine/getForAdmin) never needs a special-case "the opening message isn't in
  // the messages table" branch. If `orderId` is supplied it's only checked to belong to the
  // requester (as buyer or seller) — not that it's in any particular status; "Order-related Help"
  // per SPECIFICATION.md §5.13.6 doesn't restrict which order states are eligible.
  async createTicket(requesterId: string, dto: CreateTicketDto): Promise<PublicTicket> {
    if (dto.orderId) {
      const order = await this.orders.findOne({ where: { id: dto.orderId } });
      if (!order || (order.buyerId !== requesterId && order.sellerId !== requesterId)) {
        throw new ForbiddenException('This order does not belong to you');
      }
    }

    const ticket = await this.tickets.save(
      this.tickets.create({
        requesterId,
        subject: dto.subject,
        category: dto.category,
        orderId: dto.orderId ?? null,
      }),
    );
    await this.messages.save(
      this.messages.create({ ticketId: ticket.id, senderId: requesterId, body: dto.description }),
    );
    return this.loadForRequester(ticket.id, requesterId);
  }

  async listMine(requesterId: string): Promise<AdminTicketSummary[]> {
    const rows = await this.tickets.find({
      where: { requesterId },
      relations: ['requester', 'assignedTo'],
      order: { updatedAt: 'DESC' },
    });
    return rows.map((row) => this.toSummary(row));
  }

  async getMine(requesterId: string, ticketId: string): Promise<PublicTicket> {
    return this.loadForRequester(ticketId, requesterId);
  }

  // Requester's own reply — reopens a Closed ticket back to Open (SPECIFICATION.md §5.13.6's
  // Support Specialist CAN list: "reopen ticket, if policy allows" — treating "the requester
  // posted a new message" as that policy is the simplest reading that doesn't require a separate
  // explicit reopen action).
  async reply(requesterId: string, ticketId: string, body: string): Promise<PublicTicket> {
    const ticket = await this.getOwnedOrThrow(requesterId, ticketId);
    await this.messages.save(this.messages.create({ ticketId, senderId: requesterId, body }));
    if (ticket.status === TicketStatus.Closed) {
      await this.tickets.update(ticketId, { status: TicketStatus.Open, closedAt: null });
    }
    if (ticket.assignedToId) {
      await this.notify(ticket.assignedToId, 'ახალი პასუხი ბილეთზე', `@${requesterId} უპასუხა ბილეთს "${ticket.subject}"`, ticketId);
    }
    return this.loadForRequester(ticketId, requesterId);
  }

  // --- Admin-facing ---

  async listAll(filters: { status?: TicketStatus; priority?: TicketPriority; assignedToId?: string }): Promise<AdminTicketSummary[]> {
    const qb = this.tickets
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.requester', 'requester')
      .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
      .orderBy('ticket.updatedAt', 'DESC');

    if (filters.status) qb.andWhere('ticket.status = :status', { status: filters.status });
    if (filters.priority) qb.andWhere('ticket.priority = :priority', { priority: filters.priority });
    if (filters.assignedToId) qb.andWhere('ticket.assignedToId = :assignedToId', { assignedToId: filters.assignedToId });

    const rows = await qb.getMany();
    return rows.map((row) => this.toSummary(row));
  }

  // Full thread including internal notes — admin-only, no ownership check (any staff member who
  // reached this via the AdminGuard-protected route can see any ticket).
  async getForAdmin(ticketId: string): Promise<PublicTicket> {
    const ticket = await this.getTicketOrThrow(ticketId);
    const messages = await this.messages.find({
      where: { ticketId },
      relations: ['sender'],
      order: { createdAt: 'ASC' },
    });
    return this.toPublic(ticket, messages);
  }

  async staffReply(adminId: string, ticketId: string, body: string): Promise<PublicTicket> {
    const ticket = await this.getTicketOrThrow(ticketId);
    await this.messages.save(this.messages.create({ ticketId, senderId: adminId, body, isInternalNote: false }));
    if (ticket.status === TicketStatus.Open) {
      await this.tickets.update(ticketId, { status: TicketStatus.InProgress });
    }
    await this.notify(ticket.requesterId, 'პასუხი თქვენს ბილეთზე', `თქვენს ბილეთს "${ticket.subject}" პასუხი გაეცა.`, ticketId);
    return this.getForAdmin(ticketId);
  }

  async addInternalNote(adminId: string, ticketId: string, body: string): Promise<PublicTicket> {
    await this.getTicketOrThrow(ticketId);
    await this.messages.save(this.messages.create({ ticketId, senderId: adminId, body, isInternalNote: true }));
    return this.getForAdmin(ticketId);
  }

  // Status/priority/assignment — one route, one audit-log entry, since these three fields are
  // conceptually "ticket triage metadata" rather than three separate actions. `assignedToId` must
  // be passed as an explicit `null` (not omitted) to unassign — omitted means "don't touch it."
  async updateTicket(ticketId: string, dto: UpdateTicketDto): Promise<PublicTicket> {
    await this.getTicketOrThrow(ticketId);
    const patch: Partial<Ticket> = {};
    if (dto.status !== undefined) {
      patch.status = dto.status;
      patch.closedAt = dto.status === TicketStatus.Closed ? new Date() : null;
    }
    if (dto.priority !== undefined) patch.priority = dto.priority;
    if (dto.assignedToId !== undefined) patch.assignedToId = dto.assignedToId;
    await this.tickets.update(ticketId, patch);
    return this.getForAdmin(ticketId);
  }

  async listSavedReplies(): Promise<PublicSavedReply[]> {
    const rows = await this.savedReplies.find({ order: { category: 'ASC', title: 'ASC' } });
    return rows.map((row) => ({ id: row.id, category: row.category, title: row.title, body: row.body }));
  }

  private async loadForRequester(ticketId: string, requesterId: string): Promise<PublicTicket> {
    const ticket = await this.getOwnedOrThrow(requesterId, ticketId);
    // Internal notes are never shown to the requester — filtered at the query level, not just by
    // omitting a field, so there's no risk of a mapping bug leaking one through.
    const messages = await this.messages.find({
      where: { ticketId, isInternalNote: false },
      relations: ['sender'],
      order: { createdAt: 'ASC' },
    });
    return this.toPublic(ticket, messages);
  }

  private toPublic(ticket: Ticket, messages: TicketMessage[]): PublicTicket {
    return {
      id: ticket.id,
      requesterId: ticket.requesterId,
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      orderId: ticket.orderId,
      assignedToId: ticket.assignedToId,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      closedAt: ticket.closedAt ? ticket.closedAt.toISOString() : null,
      messages: messages.map((m) => this.toPublicMessage(m)),
    };
  }

  private toPublicMessage(message: TicketMessage): PublicTicketMessage {
    return {
      id: message.id,
      senderId: message.senderId,
      senderUsername: message.sender.username,
      body: message.body,
      isInternalNote: message.isInternalNote,
      createdAt: message.createdAt.toISOString(),
    };
  }

  private toSummary(ticket: Ticket): AdminTicketSummary {
    return {
      id: ticket.id,
      requesterId: ticket.requesterId,
      requesterUsername: ticket.requester.username,
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      assignedToId: ticket.assignedToId,
      assignedToUsername: ticket.assignedTo?.username ?? null,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    };
  }

  private async getTicketOrThrow(ticketId: string): Promise<Ticket> {
    const ticket = await this.tickets.findOne({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  private async getOwnedOrThrow(requesterId: string, ticketId: string): Promise<Ticket> {
    const ticket = await this.getTicketOrThrow(ticketId);
    if (ticket.requesterId !== requesterId) {
      throw new ForbiddenException("This ticket doesn't belong to you");
    }
    return ticket;
  }
}
