import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AdminRole, BADGE_CATALOG, BadgeKey, NotificationType } from '@wavehub/shared-types';
import type { AdminBadgeGrant, PublicBadge } from '@wavehub/shared-types';
import { NotificationsService } from '../notifications/notifications.service';
import { UserBadge } from './user-badge.entity';

// Staff roles that may grant the "administration" badges (Super Admin passes implicitly). The two
// exclusive badges (Chosen, Staff) are Super Admin only — see assertCanManage.
export const BADGE_ADMIN_ROLES = [AdminRole.OperationLead, AdminRole.MainAdministrator, AdminRole.MarketplaceCoachingOpsManager];

const COACH_BADGES: BadgeKey[] = [BadgeKey.StrongestStudent, BadgeKey.CoachChosenStudent];
const ORDERS_FOR_100 = 100;

export interface BadgeActor {
  id: string;
  role: string;
}

// The badge system (owner spec "WaveHubX Badge Assignment Logic", 2026-10-04). Automatic badges are
// granted by trigger hooks called from the modules where the event happens (orders, coaching,
// subscriptions, profiles); manual ones by staff (role-checked) or by a coach for their own student.
// Every grant is one `user_badges` row — the unique (user, badge) key makes a duplicate impossible.
@Injectable()
export class BadgesService {
  private readonly logger = new Logger(BadgesService.name);

  constructor(
    @InjectRepository(UserBadge) private readonly badges: Repository<UserBadge>,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  // --- Reading ---

  // The badges a profile shows. Subscriber follows a live subscription (spec: visibility may
  // deactivate when it lapses); everything else shows while the grant exists.
  async listVisible(userId: string): Promise<PublicBadge[]> {
    const rows = await this.badges.find({ where: { userId }, order: { grantedAt: 'ASC' } });
    if (rows.some((r) => r.badgeKey === BadgeKey.Subscriber) && !(await this.hasLiveSubscription(userId))) {
      return rows.filter((r) => r.badgeKey !== BadgeKey.Subscriber).map(toPublic);
    }
    return rows.map(toPublic);
  }

  // Batched for lists (order cards, sessions, messages): which of these users carry the Verified badge.
  async verifiedSet(userIds: string[]): Promise<Set<string>> {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (ids.length === 0) return new Set();
    const rows = await this.badges.find({ where: { userId: In(ids), badgeKey: BadgeKey.Verified }, select: ['userId'] });
    return new Set(rows.map((r) => r.userId));
  }

  async listForAdmin(userId: string): Promise<AdminBadgeGrant[]> {
    const rows = await this.badges.find({ where: { userId }, relations: ['grantedBy'], order: { grantedAt: 'ASC' } });
    return rows.map((r) => ({ ...toPublic(r), source: r.source, grantedByUsername: r.grantedBy?.username ?? null }));
  }

  // --- Automatic triggers (never throw into the caller's flow) ---

  async onOrdersCompleted(userIds: string[]): Promise<void> {
    for (const userId of [...new Set(userIds)]) {
      try {
        const [{ n }] = await this.dataSource.query(
          `SELECT count(*)::int AS n FROM "orders" WHERE "status" = 'completed' AND ("buyerId" = $1 OR "sellerId" = $1)`,
          [userId],
        );
        if (n >= 1) await this.grantSystem(userId, BadgeKey.FirstOrder);
        if (n >= ORDERS_FOR_100) await this.grantSystem(userId, BadgeKey.Orders100);
      } catch (err) {
        this.logger.error(`Order badge check failed for ${userId}`, err as Error);
      }
    }
  }

  async onCoachVerified(userId: string): Promise<void> {
    await this.safe(() => this.grantSystem(userId, BadgeKey.Verified));
  }

  // Coach rejected/suspended: a system-granted Verified badge goes; a staff-granted one stays.
  async onCoachUnverified(userId: string): Promise<void> {
    await this.safe(() => this.badges.delete({ userId, badgeKey: BadgeKey.Verified, source: 'system' }).then(() => undefined));
  }

  async onSubscriptionActivated(userId: string): Promise<void> {
    await this.safe(() => this.grantSystem(userId, BadgeKey.Subscriber));
  }

  async onRank(userId: string, tierIndex: number, lastTierIndex: number): Promise<void> {
    if (tierIndex >= lastTierIndex) await this.safe(() => this.grantSystem(userId, BadgeKey.MaxLevel));
  }

  // --- Staff grants ---

  async adminGrant(actor: BadgeActor, userId: string, key: BadgeKey): Promise<AdminBadgeGrant[]> {
    this.assertCanManage(actor, key);
    await this.assertUser(userId);
    await this.insertOrConflict(userId, key, 'admin', actor.id);
    await this.notifyGranted(userId, key);
    return this.listForAdmin(userId);
  }

  async adminRevoke(actor: BadgeActor, userId: string, key: BadgeKey): Promise<AdminBadgeGrant[]> {
    this.assertCanManage(actor, key, true);
    const res = await this.badges.delete({ userId, badgeKey: key });
    if (!res.affected) throw new NotFoundException('The user does not have this badge');
    return this.listForAdmin(userId);
  }

  // --- Coach grants (only for their own students, i.e. with a completed session) ---

  async coachStudents(coachUserId: string): Promise<Array<{ userId: string; username: string; firstName: string; lastName: string; avatarUrl: string | null; completedSessions: number; badges: BadgeKey[] }>> {
    const coachId = await this.coachIdFor(coachUserId);
    const rows: Array<{ userId: string; username: string; firstName: string; lastName: string; avatarUrl: string | null; n: number }> = await this.dataSource.query(
      `SELECT u."id" AS "userId", u."username", u."firstName", u."lastName", u."avatarUrl", count(*)::int AS n
         FROM "coaching_sessions" s JOIN "users" u ON u."id" = s."buyerId"
        WHERE s."coachId" = $1 AND s."status" = 'completed'
        GROUP BY u."id" ORDER BY max(s."completedAt") DESC NULLS LAST`,
      [coachId],
    );
    const grants = rows.length
      ? await this.badges.find({ where: { userId: In(rows.map((r) => r.userId)), badgeKey: In(COACH_BADGES), grantedById: coachUserId } })
      : [];
    return rows.map((r) => ({
      userId: r.userId,
      username: r.username,
      firstName: r.firstName,
      lastName: r.lastName,
      avatarUrl: r.avatarUrl,
      completedSessions: r.n,
      badges: grants.filter((g) => g.userId === r.userId).map((g) => g.badgeKey),
    }));
  }

  async coachGrant(coachUserId: string, studentId: string, key: BadgeKey): Promise<void> {
    if (!COACH_BADGES.includes(key)) throw new BadRequestException('A coach can only grant the student badges');
    const coachId = await this.coachIdFor(coachUserId);
    if (studentId === coachUserId) throw new ForbiddenException("You can't grant a badge to yourself");
    const [{ n }] = await this.dataSource.query(
      `SELECT count(*)::int AS n FROM "coaching_sessions" WHERE "coachId" = $1 AND "buyerId" = $2 AND "status" = 'completed'`,
      [coachId, studentId],
    );
    if (n === 0) throw new ForbiddenException('Only a student you completed a session with can get this badge');
    await this.dataSource.transaction(async (m) => {
      // One active "chosen student" per coach: choosing a new one moves the badge.
      if (key === BadgeKey.CoachChosenStudent) {
        await m.delete(UserBadge, { badgeKey: key, grantedById: coachUserId, source: 'coach' });
      }
      const existing = await m.findOne(UserBadge, { where: { userId: studentId, badgeKey: key } });
      if (existing) throw new ConflictException('The student already has this badge');
      try {
        await m.insert(UserBadge, { userId: studentId, badgeKey: key, source: 'coach', grantedById: coachUserId });
      } catch (err) {
        // A concurrent grant won the unique (user, badge) key — the transaction rolls back.
        if ((err as { code?: string }).code === '23505') throw new ConflictException('The student already has this badge');
        throw err;
      }
    });
    await this.notifyGranted(studentId, key);
  }

  async coachRevoke(coachUserId: string, studentId: string, key: BadgeKey): Promise<void> {
    if (!COACH_BADGES.includes(key)) throw new BadRequestException('A coach can only manage the student badges');
    await this.coachIdFor(coachUserId);
    const res = await this.badges.delete({ userId: studentId, badgeKey: key, grantedById: coachUserId, source: 'coach' });
    if (!res.affected) throw new NotFoundException('You have not granted this badge to the student');
  }

  // --- internals ---

  private assertCanManage(actor: BadgeActor, key: BadgeKey, revoking = false): void {
    const meta = BADGE_CATALOG[key];
    if (!meta) throw new BadRequestException('Unknown badge');
    const superAdmin = actor.role === AdminRole.SuperAdmin;
    if (meta.mode === 'super_admin' && !superAdmin) throw new ForbiddenException('Only a Super Admin can manage this badge');
    // Automatic badges come from their trigger; only a Super Admin may correct (revoke) one.
    if (meta.mode === 'auto' && !(revoking && superAdmin)) throw new BadRequestException('This badge is granted automatically');
    if (!superAdmin && !BADGE_ADMIN_ROLES.includes(actor.role as AdminRole)) throw new ForbiddenException('Not allowed to manage badges');
  }

  private async grantSystem(userId: string, key: BadgeKey): Promise<void> {
    const res = await this.badges
      .createQueryBuilder()
      .insert()
      .values({ userId, badgeKey: key, source: 'system', grantedById: null })
      .orIgnore()
      .execute();
    if ((res.raw as unknown[]).length) await this.notifyGranted(userId, key);
  }

  private async insertOrConflict(userId: string, key: BadgeKey, source: 'admin' | 'coach', grantedById: string): Promise<void> {
    try {
      await this.badges.insert({ userId, badgeKey: key, source, grantedById });
    } catch (err) {
      if ((err as { code?: string }).code === '23505') throw new ConflictException('The user already has this badge');
      throw err;
    }
  }

  private async notifyGranted(userId: string, key: BadgeKey): Promise<void> {
    const meta = BADGE_CATALOG[key];
    await this.notifications.tryEmit(userId, NotificationType.BadgeGranted, 'ახალი ბეიჯი', `მიიღე ბეიჯი „${meta.label}“ — ${meta.description}`, {
      link: '/profile',
      badge: key,
    });
  }

  private async hasLiveSubscription(userId: string): Promise<boolean> {
    const [{ n }] = await this.dataSource.query(
      `SELECT count(*)::int AS n FROM "user_subscriptions" WHERE "userId" = $1 AND "status" IN ('active', 'past_due')`,
      [userId],
    );
    return n > 0;
  }

  private async coachIdFor(userId: string): Promise<string> {
    const [row] = await this.dataSource.query(
      `SELECT "id" FROM "coaches" WHERE "userId" = $1 AND "verificationStatus" = 'verified' AND "status" = 'active'`,
      [userId],
    );
    if (!row) throw new ForbiddenException('Only an active, verified coach can do this');
    return row.id;
  }

  private async assertUser(userId: string): Promise<void> {
    const [row] = await this.dataSource.query(`SELECT 1 FROM "users" WHERE "id" = $1`, [userId]);
    if (!row) throw new NotFoundException('User not found');
  }

  private async safe(fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.logger.error('Badge trigger failed', err as Error);
    }
  }
}

function toPublic(row: UserBadge): PublicBadge {
  const meta = BADGE_CATALOG[row.badgeKey];
  return { key: row.badgeKey, label: meta?.label ?? row.badgeKey, description: meta?.description ?? '', grantedAt: row.grantedAt.toISOString() };
}
