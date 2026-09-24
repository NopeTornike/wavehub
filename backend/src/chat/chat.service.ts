import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConversationType, MessageStatus, MessageType, NotificationType } from '@wavehub/shared-types';
import type { PublicConversationSummary, PublicMessage } from '@wavehub/shared-types';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { Order } from '../orders/order.entity';
import { CoachingSession } from '../coaching/coaching-session.entity';
import { User } from '../users/user.entity';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(Conversation) private readonly conversations: Repository<Conversation>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    // Read-only, entity-level dependencies (not module-level — ChatModule does not import
    // OrdersModule/CoachingModule/UsersModule) used only to answer "have these two users
    // transacted together?" and "what's this user's username?" for Direct conversations. Keeps
    // the existing one-directional OrdersModule/CoachingModule → ChatModule import shape intact —
    // see the Direct-messaging gotcha in CLAUDE.md.
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(CoachingSession) private readonly coachingSessions: Repository<CoachingSession>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly notifications: NotificationsService,
  ) {}

  // Idempotent — safe to call unconditionally from OrdersService.purchase even though it should
  // only ever actually insert once per order (one conversation per order, enforced by the UNIQUE
  // constraint on `orderId` — a second concurrent call would hit that constraint, not silently
  // duplicate a row).
  async ensureConversation(orderId: string, buyerId: string, sellerId: string): Promise<Conversation> {
    const existing = await this.conversations.findOne({ where: { orderId } });
    if (existing) {
      return existing;
    }
    return this.conversations.save(this.conversations.create({ orderId, buyerId, sellerId }));
  }

  async listMessages(orderId: string): Promise<PublicMessage[]> {
    const conversation = await this.conversations.findOne({ where: { orderId } });
    if (!conversation) {
      return [];
    }
    const rows = await this.messages.find({
      where: { conversationId: conversation.id },
      relations: ['sender'],
      order: { createdAt: 'ASC' },
    });
    return rows.map((message) => this.toPublicMessage(message));
  }

  async postMessage(orderId: string, senderId: string, body: string): Promise<PublicMessage> {
    const conversation = await this.conversations.findOne({ where: { orderId } });
    if (!conversation) {
      throw new NotFoundException('Conversation not found for this order');
    }
    const message = await this.messages.save(
      this.messages.create({ conversationId: conversation.id, senderId, type: MessageType.Text, body }),
    );
    // Re-fetch with the sender relation loaded rather than hand-assembling the public shape from
    // the caller's own user id — keeps `toPublicMessage` the single place that does this mapping.
    const withSender = await this.messages.findOne({ where: { id: message.id }, relations: ['sender'] });

    // Best-effort, same principle as postSystemMessage's callers — a notification failure must
    // never block a real chat message from sending. Only the recipient (not the sender) gets one.
    const recipientId = senderId === conversation.buyerId ? conversation.sellerId : conversation.buyerId;
    try {
      await this.notifications.emit(
        recipientId,
        NotificationType.NewMessage,
        'ახალი შეტყობინება',
        body,
        { orderId },
      );
    } catch (err) {
      this.logger.error(`Failed to notify user ${recipientId} of new message`, err as Error);
    }

    return this.toPublicMessage(withSender!);
  }

  // Called from OrdersService at lifecycle transitions (order paid/started/delivered/revision
  // requested/cancelled/completed) — best-effort. If the conversation somehow doesn't exist yet
  // (shouldn't happen post-purchase, but this must never be the thing that blocks a real order
  // state change), this silently no-ops rather than throwing; the caller wraps it in try/catch
  // regardless, see orders/CLAUDE.md.
  async postSystemMessage(orderId: string, body: string): Promise<void> {
    const conversation = await this.conversations.findOne({ where: { orderId } });
    if (!conversation) {
      return;
    }
    await this.messages.save(
      this.messages.create({ conversationId: conversation.id, senderId: null, type: MessageType.System, body }),
    );
  }

  // Gate for Direct conversations — LAUNCH_PLAN.md §4's "transacted users only" rule, enforced
  // server-side, not just hidden in the UI. True if the two users share a real Order (either
  // direction — either could be buyer) or a real CoachingSession (joined through Coach to compare
  // against the coach's userId, since CoachingSession.coachId is a Coach profile id, not a user id).
  private async haveTransactedTogether(userA: string, userB: string): Promise<boolean> {
    const orderCount = await this.orders.count({
      where: [
        { buyerId: userA, sellerId: userB },
        { buyerId: userB, sellerId: userA },
      ],
    });
    if (orderCount > 0) {
      return true;
    }
    const sessionCount = await this.coachingSessions
      .createQueryBuilder('s')
      .innerJoin('s.coach', 'coach')
      .where('(s.buyerId = :userA AND coach.userId = :userB) OR (s.buyerId = :userB AND coach.userId = :userA)', {
        userA,
        userB,
      })
      .getCount();
    return sessionCount > 0;
  }

  // Finds or creates the one Direct conversation between two users. Idempotent under race the
  // same way ensureConversation() is — a concurrent second call hits the partial unique index
  // (`UQ_direct_conversation_pair`, keyed on the unordered pair) instead of creating a duplicate
  // thread; caught below and re-fetched rather than surfaced as an error.
  async getOrCreateDirectConversation(initiatorId: string, recipientId: string): Promise<Conversation> {
    if (initiatorId === recipientId) {
      throw new BadRequestException('You cannot message yourself');
    }
    const recipient = await this.users.findOne({ where: { id: recipientId }, select: ['id'] });
    if (!recipient) {
      throw new NotFoundException('User not found');
    }
    const existing = await this.findDirectConversation(initiatorId, recipientId);
    if (existing) {
      return existing;
    }
    if (!(await this.haveTransactedTogether(initiatorId, recipientId))) {
      throw new ForbiddenException('You can only message users you have an order or coaching session with');
    }
    try {
      return await this.conversations.save(
        this.conversations.create({ type: ConversationType.Direct, buyerId: initiatorId, sellerId: recipientId }),
      );
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        const nowExisting = await this.findDirectConversation(initiatorId, recipientId);
        if (nowExisting) {
          return nowExisting;
        }
      }
      throw err;
    }
  }

  private async findDirectConversation(userA: string, userB: string): Promise<Conversation | null> {
    return this.conversations.findOne({
      where: [
        { type: ConversationType.Direct, buyerId: userA, sellerId: userB },
        { type: ConversationType.Direct, buyerId: userB, sellerId: userA },
      ],
    });
  }

  async listMyDirectConversations(userId: string): Promise<PublicConversationSummary[]> {
    const rows = await this.conversations.find({ where: [{ type: ConversationType.Direct, buyerId: userId }, { type: ConversationType.Direct, sellerId: userId }], order: { createdAt: 'DESC' } });
    return Promise.all(rows.map((conversation) => this.toConversationSummary(conversation, userId)));
  }

  // Total unread across the viewer's Direct conversations — the topbar/sidebar message badge.
  async countUnreadDirect(userId: string): Promise<number> {
    return this.messages
      .createQueryBuilder('m')
      .innerJoin(Conversation, 'c', 'c.id = m.conversationId')
      .where('c.type = :type', { type: ConversationType.Direct })
      .andWhere('(c.buyerId = :userId OR c.sellerId = :userId)', { userId })
      .andWhere('m.senderId IS NOT NULL AND m.senderId != :userId', { userId })
      .andWhere('m.status != :seen', { seen: MessageStatus.Seen })
      .getCount();
  }

  async listDirectMessages(conversationId: string, userId: string): Promise<PublicMessage[]> {
    const conversation = await this.getDirectConversationForParticipant(conversationId, userId);
    // Opening the thread is what "reads" it: the other participant's messages become `seen`.
    await this.messages
      .createQueryBuilder()
      .update(Message)
      .set({ status: MessageStatus.Seen })
      .where('conversationId = :conversationId', { conversationId: conversation.id })
      .andWhere('senderId IS NOT NULL AND senderId != :userId', { userId })
      .andWhere('status != :seen', { seen: MessageStatus.Seen })
      .execute();
    const rows = await this.messages.find({
      where: { conversationId: conversation.id },
      relations: ['sender'],
      order: { createdAt: 'ASC' },
    });
    return rows.map((message) => this.toPublicMessage(message));
  }

  async postDirectMessage(conversationId: string, senderId: string, body: string): Promise<PublicMessage> {
    const conversation = await this.getDirectConversationForParticipant(conversationId, senderId);
    const message = await this.messages.save(
      this.messages.create({ conversationId: conversation.id, senderId, type: MessageType.Text, body }),
    );
    const withSender = await this.messages.findOne({ where: { id: message.id }, relations: ['sender'] });

    const recipientId = senderId === conversation.buyerId ? conversation.sellerId : conversation.buyerId;
    try {
      await this.notifications.emit(recipientId, NotificationType.NewMessage, 'ახალი შეტყობინება', body, {
        conversationId: conversation.id,
      });
    } catch (err) {
      this.logger.error(`Failed to notify user ${recipientId} of new direct message`, err as Error);
    }

    return this.toPublicMessage(withSender!);
  }

  private async getDirectConversationForParticipant(conversationId: string, userId: string): Promise<Conversation> {
    const conversation = await this.conversations.findOne({ where: { id: conversationId, type: ConversationType.Direct } });
    if (!conversation || (conversation.buyerId !== userId && conversation.sellerId !== userId)) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  private async toConversationSummary(conversation: Conversation, viewerId: string): Promise<PublicConversationSummary> {
    const otherUserId = conversation.buyerId === viewerId ? conversation.sellerId : conversation.buyerId;
    const [otherUser, lastMessage, unreadCount] = await Promise.all([
      this.users.findOne({ where: { id: otherUserId }, select: ['id', 'username'] }),
      this.messages.findOne({ where: { conversationId: conversation.id }, order: { createdAt: 'DESC' } }),
      this.messages
        .createQueryBuilder('m')
        .where('m.conversationId = :id', { id: conversation.id })
        .andWhere('m.senderId = :otherUserId', { otherUserId })
        .andWhere('m.status != :seen', { seen: MessageStatus.Seen })
        .getCount(),
    ]);
    return {
      id: conversation.id,
      otherUser: { id: otherUserId, username: otherUser?.username ?? 'deleted-user' },
      lastMessage: lastMessage
        ? { body: lastMessage.body, createdAt: lastMessage.createdAt.toISOString(), senderId: lastMessage.senderId }
        : null,
      createdAt: conversation.createdAt.toISOString(),
      unreadCount,
    };
  }

  private toPublicMessage(message: Message): PublicMessage {
    return {
      id: message.id,
      type: message.type,
      body: message.body,
      status: message.status,
      senderId: message.senderId,
      senderUsername: message.sender?.username ?? null,
      createdAt: message.createdAt.toISOString(),
    };
  }
}
