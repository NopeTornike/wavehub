import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { DataSource, In, LessThan, Repository } from 'typeorm';
import { NotificationType, UserStatus } from '@wavehub/shared-types';
import type { AdminUserReport, ReportStatus, RiskAssessment, RiskFactor, TrustOverview, TrustUserDetail, TrustUserSummary } from '@wavehub/shared-types';
import { LoginEvent, UserReport, UserStaffNote } from './trust.entities';
import { CreateReportDto } from './dto/trust.dto';
import { User } from '../users/user.entity';
import { NotificationsService } from '../notifications/notifications.service';

const DAY = 86400_000;
const LOGIN_RETENTION_DAYS = 90;
const NETWORK_WINDOW_DAYS = 30;
const POSTGRES_UNIQUE_VIOLATION = '23505';
const LIVE: ReportStatus[] = ['open', 'reviewing'];

type Signals = {
  status: UserStatus;
  flagged: boolean;
  createdAt: Date;
  verified: boolean;
  openReports: number;
  openReporters: number;
  actionedReports: number;
  warnings: number;
  cancelledAsSeller: number;
  disputesAgainst: number;
  linkedAccounts: number;
  failedLogins24h: number;
  sharedPromo: number;
};

// Trust & Safety (trust/CLAUDE.md): reports from users, a transparent risk score computed from
// real rows (every point comes with its reason), hashed login history for shared-network
// detection, staff notes / watchlist / official warnings. No wallet or role powers — those stay
// with the roles that already have them (SPECIFICATION.md §5.13.5 "CANNOT").
@Injectable()
export class TrustService {
  private readonly logger = new Logger(TrustService.name);

  constructor(
    @InjectRepository(UserReport) private readonly reports: Repository<UserReport>,
    @InjectRepository(UserStaffNote) private readonly notes: Repository<UserStaffNote>,
    @InjectRepository(LoginEvent) private readonly logins: Repository<LoginEvent>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  // --- Reports from users ---

  private async resolveTarget(reporterId: string, type: CreateReportDto['targetType'], id: string): Promise<{ targetUserId: string; evidence: string | null }> {
    const one = async (sql: string) => (await this.dataSource.query(sql, [id]))[0] as Record<string, string> | undefined;
    if (type === 'user') {
      const row = await one(`SELECT id AS "userId" FROM users WHERE id = $1`);
      if (!row) throw new NotFoundException('User not found');
      return { targetUserId: row.userId, evidence: null };
    }
    if (type === 'listing') {
      const row = await one(`SELECT "sellerId" AS "userId" FROM listings WHERE id = $1`);
      if (!row) throw new NotFoundException('Listing not found');
      return { targetUserId: row.userId, evidence: null };
    }
    if (type === 'coach') {
      const row = await one(`SELECT "userId" FROM coaches WHERE id = $1`);
      if (!row) throw new NotFoundException('Coach not found');
      return { targetUserId: row.userId, evidence: null };
    }
    if (type === 'review') {
      const row =
        (await one(`SELECT "buyerId" AS "userId", body FROM reviews WHERE id = $1`)) ??
        (await one(`SELECT "buyerId" AS "userId", body FROM coaching_session_reviews WHERE id = $1`));
      if (!row) throw new NotFoundException('Review not found');
      return { targetUserId: row.userId, evidence: row.body ?? null };
    }
    // A direct/order message: only a participant of that conversation can report it.
    const row = (await this.dataSource.query(
      `SELECT m."senderId" AS "userId", m.body, c."buyerId", c."sellerId" FROM messages m JOIN conversations c ON c.id = m."conversationId" WHERE m.id = $1`,
      [id],
    ))[0] as { userId: string | null; body: string; buyerId: string; sellerId: string } | undefined;
    if (!row || !row.userId) throw new NotFoundException('Message not found');
    if (row.buyerId !== reporterId && row.sellerId !== reporterId) throw new ForbiddenException('You can only report messages in your own conversations');
    return { targetUserId: row.userId, evidence: row.body.slice(0, 2000) };
  }

  async createReport(reporterId: string, dto: CreateReportDto): Promise<{ id: string; status: ReportStatus }> {
    const { targetUserId, evidence } = await this.resolveTarget(reporterId, dto.targetType, dto.targetId);
    if (targetUserId === reporterId) throw new BadRequestException("You can't report yourself");
    try {
      const saved = await this.reports.save(
        this.reports.create({ reporterId, targetType: dto.targetType, targetId: dto.targetId, targetUserId, reason: dto.reason, details: dto.details?.trim() || null, evidence, status: 'open' }),
      );
      return { id: saved.id, status: saved.status };
    } catch (err) {
      if ((err as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION) throw new ConflictException('You have already reported this — our team is looking at it');
      throw err;
    }
  }

  // --- Staff: reports queue ---

  private async toAdminReports(rows: UserReport[]): Promise<AdminUserReport[]> {
    const usernames = new Map<string, string>();
    const userIds = [...new Set(rows.flatMap((r) => [r.reporterId, r.targetUserId].filter((x): x is string => !!x)))];
    if (userIds.length) (await this.users.find({ where: { id: In(userIds) }, select: { id: true, username: true } })).forEach((u) => usernames.set(u.id, u.username));
    const titles = new Map<string, string>();
    const listingIds = rows.filter((r) => r.targetType === 'listing').map((r) => r.targetId);
    if (listingIds.length) (await this.dataSource.query(`SELECT id, title FROM listings WHERE id = ANY($1)`, [listingIds])).forEach((l: { id: string; title: string }) => titles.set(l.id, l.title));
    return rows.map((r) => {
      const target = r.targetUserId ? usernames.get(r.targetUserId) ?? null : null;
      const label =
        r.targetType === 'listing'
          ? titles.get(r.targetId) ?? 'განცხადება'
          : r.targetType === 'review' || r.targetType === 'message'
            ? `„${(r.evidence ?? '').slice(0, 80)}“`
            : `@${target ?? '?'}`;
      const href =
        r.targetType === 'listing' ? `/listings/${r.targetId}` : r.targetType === 'coach' ? `/coaching/${r.targetId}` : target ? `/u/${target}` : null;
      return {
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        targetUserId: r.targetUserId,
        targetUsername: target,
        targetLabel: label,
        targetHref: href,
        reporterUsername: usernames.get(r.reporterId) ?? '?',
        reason: r.reason,
        details: r.details,
        evidence: r.evidence,
        status: r.status,
        staffNote: r.staffNote,
        createdAt: r.createdAt.toISOString(),
        handledAt: r.handledAt ? r.handledAt.toISOString() : null,
      };
    });
  }

  async listReports(status: ReportStatus | 'all' = 'open'): Promise<AdminUserReport[]> {
    const rows = await this.reports.find({
      where: status === 'all' ? {} : status === 'open' ? { status: In(LIVE) } : { status },
      order: { createdAt: status === 'open' ? 'ASC' : 'DESC' },
      take: 300,
    });
    return this.toAdminReports(rows);
  }

  async handleReport(adminId: string, id: string, status: ReportStatus, staffNote?: string): Promise<AdminUserReport> {
    const report = await this.reports.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    const done = status === 'actioned' || status === 'dismissed';
    await this.reports.update(id, {
      status,
      ...(staffNote !== undefined ? { staffNote: staffNote.trim() || null } : {}),
      handledBy: adminId,
      handledAt: done ? new Date() : null,
    });
    return (await this.toAdminReports([await this.reports.findOneOrFail({ where: { id } })]))[0];
  }

  // --- Risk score ---

  private async signals(userIds: string[]): Promise<Map<string, Signals>> {
    const out = new Map<string, Signals>();
    if (!userIds.length) return out;
    const q = async (sql: string, params: unknown[] = [userIds]) => (await this.dataSource.query(sql, params)) as Array<Record<string, unknown>>;
    const count = (rows: Array<Record<string, unknown>>, key = 'n') => new Map(rows.map((r) => [String(r.id), Number(r[key])]));
    const since30 = new Date(Date.now() - NETWORK_WINDOW_DAYS * DAY);
    const [users, openR, actionedR, warnings, cancelled, disputes, linked, failed, promo] = await Promise.all([
      q(`SELECT id, status, flagged, "createdAt", "emailVerifiedAt" FROM users WHERE id = ANY($1)`),
      q(`SELECT "targetUserId" AS id, count(*)::int AS n, count(DISTINCT "reporterId")::int AS r FROM user_reports WHERE "targetUserId" = ANY($1) AND status IN ('open','reviewing') GROUP BY 1`),
      q(`SELECT "targetUserId" AS id, count(*)::int AS n FROM user_reports WHERE "targetUserId" = ANY($1) AND status = 'actioned' GROUP BY 1`),
      q(`SELECT "userId" AS id, count(*)::int AS n FROM user_staff_notes WHERE "userId" = ANY($1) AND kind = 'warning' GROUP BY 1`),
      q(`SELECT "sellerId" AS id, count(*)::int AS n FROM orders WHERE "sellerId" = ANY($1) AND status IN ('cancelled','refunded') GROUP BY 1`),
      q(`SELECT "sellerId" AS id, count(*)::int AS n FROM disputes WHERE "sellerId" = ANY($1) GROUP BY 1`),
      q(
        `SELECT a."userId" AS id, count(DISTINCT b."userId")::int AS n FROM login_events a JOIN login_events b ON b."ipHash" = a."ipHash" AND b."userId" <> a."userId" AND b."createdAt" > $2
          WHERE a."userId" = ANY($1) AND a."createdAt" > $2 GROUP BY 1`,
        [userIds, since30],
      ),
      q(`SELECT "userId" AS id, count(*)::int AS n FROM login_events WHERE "userId" = ANY($1) AND success = false AND "createdAt" > $2 GROUP BY 1`, [userIds, new Date(Date.now() - DAY)]),
      // Accounts on a shared network that redeemed the same promo code — classic promo farming.
      q(
        `SELECT r1."userId" AS id, count(DISTINCT r2."userId")::int AS n FROM promo_redemptions r1
           JOIN promo_redemptions r2 ON r2."promoCodeId" = r1."promoCodeId" AND r2."userId" <> r1."userId"
           JOIN login_events a ON a."userId" = r1."userId" AND a."createdAt" > $2
           JOIN login_events b ON b."userId" = r2."userId" AND b."ipHash" = a."ipHash" AND b."createdAt" > $2
          WHERE r1."userId" = ANY($1) GROUP BY 1`,
        [userIds, since30],
      ),
    ]);
    const m = { openR: count(openR), openReporters: count(openR, 'r'), actionedR: count(actionedR), warnings: count(warnings), cancelled: count(cancelled), disputes: count(disputes), linked: count(linked), failed: count(failed), promo: count(promo) };
    for (const u of users) {
      const id = String(u.id);
      out.set(id, {
        status: u.status as UserStatus,
        flagged: Boolean(u.flagged),
        createdAt: new Date(u.createdAt as string),
        verified: Boolean(u.emailVerifiedAt),
        openReports: m.openR.get(id) ?? 0,
        openReporters: m.openReporters.get(id) ?? 0,
        actionedReports: m.actionedR.get(id) ?? 0,
        warnings: m.warnings.get(id) ?? 0,
        cancelledAsSeller: m.cancelled.get(id) ?? 0,
        disputesAgainst: m.disputes.get(id) ?? 0,
        linkedAccounts: m.linked.get(id) ?? 0,
        failedLogins24h: m.failed.get(id) ?? 0,
        sharedPromo: m.promo.get(id) ?? 0,
      });
    }
    return out;
  }

  // Every point is explained; the frontend lists the factors next to the score.
  static score(s: Signals, now = Date.now()): RiskAssessment {
    const f: RiskFactor[] = [];
    const add = (key: string, label: string, points: number) => points > 0 && f.push({ key, label, points });
    if (s.flagged) add('flagged', 'მეთვალყურეობის სიაშია', 25);
    add('open_reports', `${s.openReports} ღია საჩივარი`, Math.min(30, s.openReports * 10));
    if (s.openReporters >= 3) add('many_reporters', `${s.openReporters} სხვადასხვა მომხმარებელმა დაასაჩივრა`, 10);
    add('actioned_reports', `${s.actionedReports} დადასტურებული საჩივარი`, Math.min(30, s.actionedReports * 15));
    add('warnings', `${s.warnings} ოფიციალური გაფრთხილება`, Math.min(20, s.warnings * 10));
    add('cancelled', `${s.cancelledAsSeller} გაუქმებული/დაბრუნებული შეკვეთა გამყიდველად`, Math.min(15, s.cancelledAsSeller * 3));
    add('disputes', `${s.disputesAgainst} დავა გამყიდველად`, Math.min(20, s.disputesAgainst * 5));
    if (s.linkedAccounts > 0) add('shared_network', `ქსელს იზიარებს ${s.linkedAccounts} სხვა ანგარიშთან (30 დღე)`, s.linkedAccounts >= 3 ? 25 : 10);
    if (s.sharedPromo > 0) add('promo_farming', `იგივე პრომო კოდი გამოიყენა ${s.sharedPromo} დაკავშირებულმა ანგარიშმა`, 15);
    if (s.failedLogins24h >= 10) add('failed_logins', `${s.failedLogins24h} წარუმატებელი შესვლა 24 საათში`, 10);
    if (now - s.createdAt.getTime() < 7 * DAY) add('new_account', 'ახალი ანგარიში (7 დღეზე ნაკლები)', 10);
    if (!s.verified) add('unverified', 'ელფოსტა დაუდასტურებელია', 5);
    const score = Math.min(100, f.reduce((sum, x) => sum + x.points, 0));
    return { score, level: score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low', factors: f.sort((a, b) => b.points - a.points) };
  }

  async assess(userId: string): Promise<RiskAssessment> {
    const s = (await this.signals([userId])).get(userId);
    if (!s) throw new NotFoundException('User not found');
    return TrustService.score(s);
  }

  // --- Overview ---

  async overview(): Promise<TrustOverview> {
    const one = async (sql: string, params: unknown[] = []) => Number(((await this.dataSource.query(sql, params))[0] as { n: number }).n);
    const since30 = new Date(Date.now() - NETWORK_WINDOW_DAYS * DAY);
    const [openReports, byReason, flaggedUsers, warnings30d, suspended, banned, newAccounts7d, groups] = await Promise.all([
      one(`SELECT count(*)::int n FROM user_reports WHERE status IN ('open','reviewing')`),
      this.dataSource.query(`SELECT reason, count(*)::int AS count FROM user_reports WHERE status IN ('open','reviewing') GROUP BY 1 ORDER BY 2 DESC`),
      one(`SELECT count(*)::int n FROM users WHERE flagged = true`),
      one(`SELECT count(*)::int n FROM user_staff_notes WHERE kind = 'warning' AND "createdAt" > $1`, [since30]),
      one(`SELECT count(*)::int n FROM users WHERE status = 'suspended'`),
      one(`SELECT count(*)::int n FROM users WHERE status = 'banned'`),
      one(`SELECT count(*)::int n FROM users WHERE "createdAt" > $1`, [new Date(Date.now() - 7 * DAY)]),
      one(`SELECT count(*)::int n FROM (SELECT "ipHash" FROM login_events WHERE "createdAt" > $1 GROUP BY 1 HAVING count(DISTINCT "userId") >= 3) g`, [since30]),
    ]);
    // Candidates: anyone with a live report, a flag, a warning, a shared network, or recent failures.
    const candidates = (await this.dataSource.query(
      `SELECT id FROM (
         SELECT "targetUserId" AS id FROM user_reports WHERE status IN ('open','reviewing','actioned') AND "targetUserId" IS NOT NULL
         UNION SELECT id FROM users WHERE flagged = true
         UNION SELECT "userId" FROM user_staff_notes WHERE kind = 'warning'
         UNION SELECT a."userId" FROM login_events a JOIN login_events b ON b."ipHash" = a."ipHash" AND b."userId" <> a."userId" WHERE a."createdAt" > $1 AND b."createdAt" > $1
       ) c LIMIT 500`,
      [since30],
    )) as Array<{ id: string }>;
    const topRisk = (await this.summaries(candidates.map((c) => c.id))).filter((u) => u.risk.score > 0).sort((a, b) => b.risk.score - a.risk.score).slice(0, 20);
    return { openReports, reportsByReason: byReason, flaggedUsers, warnings30d, suspended, banned, newAccounts7d, sharedNetworkGroups: groups, topRisk };
  }

  private async summaries(userIds: string[]): Promise<TrustUserSummary[]> {
    const ids = [...new Set(userIds)];
    if (!ids.length) return [];
    const [sig, users] = await Promise.all([this.signals(ids), this.users.find({ where: { id: In(ids) }, select: { id: true, username: true, status: true, flagged: true } })]);
    return users.filter((u) => sig.has(u.id)).map((u) => ({ userId: u.id, username: u.username, status: u.status, flagged: u.flagged, risk: TrustService.score(sig.get(u.id)!) }));
  }

  async searchUsers(q: string): Promise<TrustUserSummary[]> {
    const term = q.trim().replace(/^@/, '').toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`);
    const rows = await this.users
      .createQueryBuilder('u')
      .select(['u.id'])
      .where('lower(u.username) LIKE :p', { p: `%${term}%` })
      .orderBy('u.createdAt', 'DESC')
      .take(20)
      .getMany();
    return this.summaries(rows.map((r) => r.id));
  }

  // --- One account, everything staff need in one place ---

  async userDetail(userId: string): Promise<TrustUserDetail> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const since30 = new Date(Date.now() - NETWORK_WINDOW_DAYS * DAY);
    const [sig, notes, logins, linked, reportsAgainst, reportsFiled, stats] = await Promise.all([
      this.signals([userId]),
      this.notes.find({ where: { userId }, relations: { author: true }, order: { createdAt: 'DESC' }, take: 100 }),
      this.logins.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 50 }),
      this.dataSource.query(
        `SELECT u.id AS "userId", u.username, u.status, count(*)::int AS "sharedLogins"
           FROM login_events a JOIN login_events b ON b."ipHash" = a."ipHash" AND b."userId" <> a."userId" AND b."createdAt" > $2
           JOIN users u ON u.id = b."userId"
          WHERE a."userId" = $1 AND a."createdAt" > $2
          GROUP BY u.id ORDER BY 4 DESC LIMIT 20`,
        [userId, since30],
      ),
      this.reports.find({ where: { targetUserId: userId }, order: { createdAt: 'DESC' }, take: 50 }),
      this.reports.count({ where: { reporterId: userId } }),
      this.dataSource.query(
        `SELECT (SELECT count(*)::int FROM orders WHERE "buyerId" = $1) AS "ordersAsBuyer",
                (SELECT count(*)::int FROM orders WHERE "sellerId" = $1) AS "ordersAsSeller",
                (SELECT count(*)::int FROM orders WHERE "sellerId" = $1 AND status IN ('cancelled','refunded')) AS "cancelledAsSeller",
                (SELECT count(*)::int FROM disputes WHERE "sellerId" = $1) AS "disputesAgainst",
                (SELECT count(*)::int FROM promo_redemptions WHERE "userId" = $1) AS "promoRedemptions",
                (SELECT count(*)::int FROM user_staff_notes WHERE "userId" = $1 AND kind = 'warning') AS warnings`,
        [userId],
      ),
    ]);
    return {
      userId: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      emailVerified: Boolean(user.emailVerifiedAt),
      flagged: user.flagged,
      createdAt: user.createdAt.toISOString(),
      lastSeenAt: user.lastSeenAt ? user.lastSeenAt.toISOString() : null,
      risk: TrustService.score(sig.get(userId)!),
      notes: notes.map((n) => ({ id: n.id, kind: n.kind, body: n.body, authorUsername: n.author.username, createdAt: n.createdAt.toISOString() })),
      logins: logins.map((l) => ({ at: l.createdAt.toISOString(), success: l.success, network: l.ipHash.slice(0, 8), device: l.uaHash.slice(0, 8) })),
      linkedAccounts: linked,
      reportsAgainst: await this.toAdminReports(reportsAgainst),
      reportsFiled,
      stats: stats[0],
    };
  }

  async addNote(authorId: string, userId: string, kind: UserStaffNote['kind'], body: string): Promise<void> {
    if (!(await this.users.exist({ where: { id: userId } }))) throw new NotFoundException('User not found');
    await this.notes.insert({ userId, authorId, kind, body: body.trim() });
  }

  async warn(authorId: string, userId: string, message: string): Promise<void> {
    await this.addNote(authorId, userId, 'warning', message);
    await this.notifications.tryEmit(userId, NotificationType.AccountWarning, 'გაფრთხილება WaveHub-ის გუნდისგან', message.trim(), { link: '/pages/community-guidelines' });
  }

  async setFlag(authorId: string, userId: string, flagged: boolean, reason: string): Promise<void> {
    const res = await this.users.update({ id: userId }, { flagged });
    if (!res.affected) throw new NotFoundException('User not found');
    await this.notes.insert({ userId, authorId, kind: flagged ? 'flag' : 'unflag', body: reason.trim() });
  }

  // Login history is only needed for recent multi-account checks.
  @Cron('17 4 * * *')
  async cleanupLogins(): Promise<void> {
    try {
      await this.logins.delete({ createdAt: LessThan(new Date(Date.now() - LOGIN_RETENTION_DAYS * DAY)) });
    } catch (err) {
      this.logger.error('login_events cleanup failed', err as Error);
    }
  }
}
