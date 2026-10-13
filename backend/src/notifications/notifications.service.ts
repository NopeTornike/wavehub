import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { NotificationType } from '@wavehub/shared-types';
import type { PublicNotification } from '@wavehub/shared-types';
import { Notification } from './notification.entity';
import { EmailService } from '../email/email.service';
import { notificationEmail } from '../email/templates';
import { User } from '../users/user.entity';
import { UserStatus } from '@wavehub/shared-types';

// Events that also go out by email (client, 2026-10-02: "no email for a new order, delivery,
// completed order, approved withdrawal or dispute"). Chatty or low-stakes ones (messages,
// followers, session reminders every 10 minutes, review prompts) stay in-app only; subscription
// events pass their own `alsoEmail`.
export const EMAIL_NOTIFICATION_TYPES: ReadonlySet<NotificationType> = new Set([
  NotificationType.OrderPlaced,
  NotificationType.OrderPaid,
  NotificationType.OrderDelivered,
  NotificationType.OrderRevisionRequested,
  NotificationType.OrderCompleted,
  NotificationType.OrderCancelled,
  NotificationType.DisputeOpened,
  NotificationType.DisputeResolved,
  NotificationType.WithdrawalStatusChanged,
  NotificationType.SessionBooked,
  NotificationType.SessionCancelled,
  NotificationType.SessionAwaitingConfirmation,
  NotificationType.SessionCompleted,
  NotificationType.ListingApproved,
  NotificationType.ListingRejected,
  NotificationType.CoachApproved,
  NotificationType.CoachRejected,
  NotificationType.WalletTopup,
  NotificationType.WalletAdjusted,
  NotificationType.TicketReplied,
  NotificationType.AccountWarning,
]);

// The site page a notification is about — the same mapping as frontend/lib/notifications.ts.
export function notificationPath(type: NotificationType, metadata: Record<string, string> | null | undefined): string {
  const m = metadata ?? {};
  if (m.link && /^\/(?!\/)/.test(m.link)) return m.link;
  if (m.sessionDisputeId || (m.disputeId && m.sessionId)) return `/coaching-sessions/${m.sessionId}`;
  if (m.orderId) return `/orders/${m.orderId}`;
  if (m.sessionId) return `/coaching-sessions/${m.sessionId}`;
  if (m.ticketId) return `/support/${m.ticketId}`;
  if (m.withdrawRequestId) return '/wallet';
  if (m.tournamentId) return `/tournaments/${m.tournamentId}`;
  if (String(type).startsWith('subscription_')) return '/plans';
  return '/notifications';
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
    private readonly email: EmailService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  // Email copy of a key notification: only to active accounts that kept emails on. Fire-and-forget
  // from emit (a slow mail server must never slow down or fail the action), errors only logged —
  // never with the address (PII-free logs, root CLAUDE.md "Security").
  private async emailCopy(userId: string, type: NotificationType, title: string, body: string, metadata?: Record<string, string>): Promise<void> {
    try {
      const user = await this.users.findOne({ where: { id: userId }, select: { id: true, email: true, status: true, emailNotifications: true } });
      if (!user || user.status !== UserStatus.Active || user.emailNotifications === false) return;
      const base = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
      await this.email.send(user.email, `${title} · WaveHub`, notificationEmail(title, body, `${base}${notificationPath(type, metadata)}`));
    } catch (err) {
      this.logger.warn(`notification email (${type}) failed: ${(err as Error).message}`);
    }
  }

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
    } else if (EMAIL_NOTIFICATION_TYPES.has(type)) {
      void this.emailCopy(userId, type, title, body, metadata);
    }
    return notification;
  }

  // Best-effort `emit` for hook sites that have no `notify` helper of their own: a failed
  // notification is logged and never undoes the action that triggered it.
  async tryEmit(userId: string, type: NotificationType, title: string, body: string, metadata?: Record<string, string>): Promise<void> {
    try {
      await this.emit(userId, type, title, body, metadata);
    } catch (err) {
      this.logger.error(`Failed to notify user ${userId} (${type})`, err as Error);
    }
  }

  // Whether `userId` already got a `type` notification with metadata[key] = value in the last
  // `hours` — lets a hook site avoid repeats (e.g. follow / unfollow / follow).
  async sentRecently(userId: string, type: NotificationType, key: string, value: string, hours: number): Promise<boolean> {
    const count = await this.notifications
      .createQueryBuilder('n')
      .where('n.userId = :userId AND n.type = :type', { userId, type })
      .andWhere('n.metadata ->> :key = :value', { key, value })
      .andWhere(`n.createdAt > now() - make_interval(hours => :hours)`, { hours })
      .getCount();
    return count > 0;
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

  // The badge poll: the count plus when the newest unread one arrived — the frontend fetches the
  // list for pop-up toasts only when `latestAt` changes.
  async getUnreadSummary(userId: string): Promise<{ count: number; latestAt: string | null }> {
    const [row] = await this.notifications.query(
      `SELECT count(*)::int AS count, max("createdAt") AS "latestAt" FROM notifications WHERE "userId" = $1 AND "readAt" IS NULL`,
      [userId],
    );
    return { count: row?.count ?? 0, latestAt: row?.latestAt ? new Date(row.latestAt).toISOString() : null };
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
