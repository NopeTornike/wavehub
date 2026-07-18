import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { NotificationType } from '@wavehub/shared-types';
import type { PublicNotification } from '@wavehub/shared-types';
import { Notification } from './notification.entity';
import { EmailService } from '../email/email.service';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
    private readonly email: EmailService,
  ) {}

  // The one place a notification row is created. `alsoEmail` is for the "key" events
  // SPECIFICATION.md §5.12 calls out for a matching transactional email (new order, delivery
  // submitted, order completed, withdrawal approved, dispute updates) — bundled into the same call
  // so a hook site doesn't need two separate try/catch blocks. Both the in-app row and the email
  // are best-effort from the caller's perspective (see each hook module's own wrapper — e.g.
  // OrdersService's private `notify` helper): a notification failure must never block the real
  // action that triggered it.
  async emit(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    metadata?: Record<string, string>,
    alsoEmail?: { to: string; subject: string },
  ): Promise<Notification> {
    const notification = await this.notifications.save(
      this.notifications.create({ userId, type, title, body, metadata: metadata ?? null }),
    );
    if (alsoEmail) {
      await this.email.send(alsoEmail.to, alsoEmail.subject, body);
    }
    return notification;
  }

  async listMine(userId: string, limit: number, offset: number): Promise<PublicNotification[]> {
    const rows = await this.notifications.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return rows.map((row) => this.toPublic(row));
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notifications.count({ where: { userId, readAt: IsNull() } });
  }

  // Ownership check is the entire point of this method existing separately from a generic
  // `update()` — see notifications/CLAUDE.md for why this got its own explicit test (the build
  // plan calls this exact bug class out: "mark-as-read is scoped to the requesting user only").
  async markRead(userId: string, id: string): Promise<PublicNotification> {
    const notification = await this.notifications.findOne({ where: { id } });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.userId !== userId) {
      throw new ForbiddenException("This notification doesn't belong to you");
    }
    if (!notification.readAt) {
      await this.notifications.update(id, { readAt: new Date() });
      notification.readAt = new Date();
    }
    return this.toPublic(notification);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notifications.update({ userId, readAt: IsNull() }, { readAt: new Date() });
  }

  private toPublic(notification: Notification): PublicNotification {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      metadata: notification.metadata,
      readAt: notification.readAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString(),
    };
  }
}
