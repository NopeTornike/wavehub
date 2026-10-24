import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminRole, NotificationType, SubscriptionAudience, TicketCategory, TicketPriority, TicketStatus } from '@wavehub/shared-types';

type UploadedFile = { buffer: Buffer; originalname: string };
import type { AdminTicketSummary, PublicSavedReply, PublicTicket, PublicTicketMessage } from '@wavehub/shared-types';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { StorageService } from '../storage/storage.service';
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
    private readonly subscriptions: SubscriptionsService,
    private readonly storage: StorageService,
  ) {}

  // Staff who answer tickets (admin-tickets.controller TICKET_REPLY_ROLES + Operation Lead, who
  // can view and triage). An assigned ticket goes to its assignee only.
  private async notifySupportStaff(ticket: { id: string; subject: string; assignedToId?: string | null }, title: string) {
    await this.notifications.notifyStaff(
      [AdminRole.MainAdministrator, AdminRole.SupportSpecialist, AdminRole.OperationLead],
      title,
      `„${ticket.subject}“`,
      `/admin/tickets/${ticket.id}`,
      `ticket:${ticket.id}`,
      { onlyUserId: ticket.assignedToId ?? null },
    );
  }

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

    const priority = await this.priorityFor(requesterId);

    const ticket = await this.tickets.save(
      this.tickets.create({
        requesterId,
        ...(priority ? { priority } : {}),
        subject: dto.subject,
        category: dto.category,
        orderId: dto.orderId ?? null,
      }),
    );
    await this.messages.save(
      this.messages.create({ ticketId: ticket.id, senderId: requesterId, body: dto.description }),
    );
    await this.notifySupportStaff(ticket, 'ახალი ბილეთი Support-ში');
    return this.loadForRequester(ticket.id, requesterId);
  }

  // `prioritySupport` perk (either audience's plan): tickets open as High instead of the default.
  private async priorityFor(requesterId: string): Promise<TicketPriority | undefined> {
    const [buyerPerks, sellerPerks] = await Promise.all([
      this.subscriptions.getActivePerks(requesterId, SubscriptionAudience.Buyer),
      this.subscriptions.getActivePerks(requesterId, SubscriptionAudience.SellerCoach),
    ]);
    return buyerPerks?.prioritySupport || sellerPerks?.prioritySupport ? TicketPriority.High : undefined;
  }

  // --- Live support chat (2026-10-24, "Contact support") ---
  // One open chat per user: a ticket on the 'chat' channel. The greeting / "looking for an
  // operator" / "thanks for waiting" lines are the frontend's (they describe this state, they
  // aren't stored); an operator joining is real — `operator` + `operatorJoinedAt`.

  private openChat(requesterId: string): Promise<Ticket | null> {
    return this.tickets
      .createQueryBuilder('t')
      .where('t.requesterId = :requesterId AND t.channel = :chat AND t.status <> :closed', { requesterId, chat: 'chat', closed: TicketStatus.Closed })
      .orderBy('t.createdAt', 'DESC')
      .getOne();
  }

  async getLiveChat(requesterId: string): Promise<PublicTicket | null> {
    const chat = await this.openChat(requesterId);
    return chat ? this.loadForRequester(chat.id, requesterId) : null;
  }

  // The first message opens the chat (staff are notified); later ones go to the same chat.
  async sendLiveMessage(requesterId: string, body: string): Promise<PublicTicket> {
    const chat = await this.openChat(requesterId);
    if (chat) return this.reply(requesterId, chat.id, body);
    const priority = await this.priorityFor(requesterId);
    const ticket = await this.tickets.save(
      this.tickets.create({ requesterId, channel: 'chat', subject: 'Live chat', category: TicketCategory.Other, ...(priority ? { priority } : {}) }),
    );
    await this.messages.save(this.messages.create({ ticketId: ticket.id, senderId: requesterId, body }));
    await this.notifySupportStaff(ticket, 'ახალი ლაივ ჩატი Support-ში');
    return this.loadForRequester(ticket.id, requesterId);
  }

  // A staff member joins a live chat (or takes it over): they become its operator and assignee.
  async joinChat(adminId: string, ticketId: string): Promise<PublicTicket> {
    const ticket = await this.getTicketOrThrow(ticketId);
    if (ticket.channel !== 'chat') throw new BadRequestException('Only a live chat can be joined');
    if (ticket.operatorId !== adminId) {
      await this.tickets.update(ticketId, {
        operatorId: adminId,
        operatorJoinedAt: new Date(),
        assignedToId: adminId,
        ...(ticket.status === TicketStatus.Open ? { status: TicketStatus.InProgress } : {}),
      });
    }
    return this.getForAdmin(ticketId);
  }

  // The first staff message on a chat nobody joined yet counts as joining it.
  private async joinOnReply(ticket: Ticket, adminId: string): Promise<void> {
    if (ticket.channel === 'chat' && !ticket.operatorId) {
      await this.tickets.update(ticket.id, { operatorId: adminId, operatorJoinedAt: new Date(), ...(ticket.assignedToId ? {} : { assignedToId: adminId }) });
    }
  }

  // --- Attachments (screenshots, PDF, Word .docx) on any ticket or chat ---

  private async saveAttachment(ticketId: string, senderId: string, file: UploadedFile | undefined): Promise<void> {
    if (!file) throw new BadRequestException('No file uploaded');
    // Byte-sniffed (JPG/PNG/WEBP/PDF/ZIP-based like .docx); names are UUIDs (storage/CLAUDE.md).
    const stored = await this.storage.save(file.buffer, file.originalname, 'attachment');
    // Multer hands over the multipart filename as latin1; restore UTF-8 (Georgian names) when it
    // decodes cleanly. Then keep printable characters only (no control characters or path separators).
    const raw = file.originalname || 'file';
    const utf8 = Buffer.from(raw, 'latin1').toString('utf8');
    const fileName = Array.from(utf8.includes('\uFFFD') ? raw : utf8).filter((ch) => ch.charCodeAt(0) >= 32 && ch !== '/' && ch !== '\\').join('').slice(0, 200) || 'file';
    await this.messages.save(
      this.messages.create({ ticketId, senderId, body: '', fileUrl: stored.url, fileType: stored.contentType ?? null, fileName }),
    );
  }

  async addAttachment(requesterId: string, ticketId: string, file: UploadedFile | undefined): Promise<PublicTicket> {
    const ticket = await this.getOwnedOrThrow(requesterId, ticketId);
    if (ticket.status === TicketStatus.Closed) throw new ConflictException('This conversation is closed');
    await this.saveAttachment(ticketId, requesterId, file);
    await this.notifySupportStaff(ticket, 'ახალი ფაილი ბილეთზე');
    return this.loadForRequester(ticketId, requesterId);
  }

  async staffAttachment(adminId: string, ticketId: string, file: UploadedFile | undefined): Promise<PublicTicket> {
    const ticket = await this.getTicketOrThrow(ticketId);
    await this.saveAttachment(ticketId, adminId, file);
    await this.joinOnReply(ticket, adminId);
    await this.notify(ticket.requesterId, 'პასუხი Support-ისგან', 'Support-მა ფაილი გამოგიგზავნა.', ticketId);
    return this.getForAdmin(ticketId);
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
    await this.notifySupportStaff(ticket, 'ახალი შეტყობინება ბილეთზე');
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
    await this.joinOnReply(ticket, adminId);
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
      channel: ticket.channel,
      operator:
        ticket.operator && ticket.operatorJoinedAt
          ? { firstName: ticket.operator.firstName, avatarUrl: ticket.operator.avatarUrl ?? null, joinedAt: ticket.operatorJoinedAt.toISOString() }
          : null,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      closedAt: ticket.closedAt ? ticket.closedAt.toISOString() : null,
      messages: messages.map((m) => this.toPublicMessage(m, ticket.requesterId)),
    };
  }

  private toPublicMessage(message: TicketMessage, requesterId: string): PublicTicketMessage {
    return {
      id: message.id,
      senderId: message.senderId,
      // Support staff are shown as "Support — Name"; their username is a login name, never sent.
      senderUsername: message.senderId !== requesterId ? '' : message.sender.username,
      senderFirstName: message.sender.firstName,
      senderLastName: message.sender.lastName,
      senderAvatarUrl: message.sender.avatarUrl ?? null,
      fromSupport: message.senderId !== requesterId,
      body: message.body,
      fileUrl: message.fileUrl ?? null,
      fileType: message.fileType ?? null,
      fileName: message.fileName ?? null,
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
      channel: ticket.channel,
      assignedToUsername: ticket.assignedTo?.username ?? null,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    };
  }

  private async getTicketOrThrow(ticketId: string): Promise<Ticket> {
    const ticket = await this.tickets.findOne({ where: { id: ticketId }, relations: { operator: true } });
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
