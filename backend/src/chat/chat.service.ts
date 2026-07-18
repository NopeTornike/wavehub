import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageType, NotificationType } from '@wavehub/shared-types';
import type { PublicMessage } from '@wavehub/shared-types';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(Conversation) private readonly conversations: Repository<Conversation>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
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
