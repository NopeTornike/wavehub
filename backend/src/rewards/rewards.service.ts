import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { AdminRole, NotificationType } from '@wavehub/shared-types';
import type {
  AdminRewards,
  AdminRewardTask,
  AdminRewardWinner,
  RewardHub,
  RewardLeaderRow,
  RewardPeriod,
  RewardPrizeView,
  RewardTaskView,
  RewardTrigger,
  RewardWinView,
} from '@wavehub/shared-types';
import { PlatformSettingsService } from '../settings/platform-settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import { RewardTaskDto } from './dto/reward.dto';

// User Hub rewards (owner 2026-11-10, docs/design-mockups/round-6/02). See ./CLAUDE.md.
//
// Days run midnight-to-midnight Tbilisi time (UTC+4, no DST); weeks Monday–Sunday. A task's
// progress is counted from real rows (orders, top-ups, follows, …) — never from what the client
// says, except the page-visit / check-in log the pages write themselves. XP is credited when the
// hub is opened (today and yesterday are checked, so finishing a task at 23:59 isn't lost), into a
// ledger whose (userId, key) is unique — a task pays once per day (or once ever), however many
// requests race.

const TZ_OFFSET_MS = 4 * 3_600_000;
const DAY_MS = 86_400_000;
const LEADERBOARD_SIZE = 10;
const LEADERBOARD_TTL_MS = 30_000;
export const REWARD_STAFF_ROLES = [AdminRole.SuperAdmin, AdminRole.OperationLead, AdminRole.MainAdministrator];
export const VISIT_PAGES = ['marketplace', 'services', 'steam', 'tournaments', 'coaching'] as const;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type UploadedImage = { buffer: Buffer; originalname: string; mimetype: string; size: number };
type TaskRow = { id: string; title: string; description: string | null; trigger: RewardTrigger; target: number; xp: number; period: RewardPeriod; isActive: boolean; sortOrder: number };

// A raw `UPDATE … RETURNING` resolves to [rows, count] on Postgres.
function updatedCount(result: unknown): number {
  return Array.isArray(result) && Array.isArray(result[0]) ? result[0].length : Array.isArray(result) ? result.length : 0;
}

// Tbilisi calendar helpers (pure — exported for unit tests).
export function tbilisiDay(at: number): string {
  return new Date(at + TZ_OFFSET_MS).toISOString().slice(0, 10);
}
export function dayStartUtc(day: string): Date {
  return new Date(Date.parse(`${day}T00:00:00Z`) - TZ_OFFSET_MS);
}
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}
export function weekStartOf(day: string): string {
  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(day, -weekday);
}
// Level L starts at 50·L·(L−1) XP: 0, 100, 300, 600, 1000, … (each level 100 XP longer than the last).
export function levelFor(xp: number): { level: number; levelFloor: number; nextLevelAt: number } {
  let level = 1;
  while (50 * (level + 1) * level <= xp) level += 1;
  return { level, levelFloor: 50 * level * (level - 1), nextLevelAt: 50 * (level + 1) * level };
}
// Consecutive check-in days ending today (or yesterday, when today isn't checked in yet).
export function streakFrom(days: string[], today: string): { days: number; todayDone: boolean } {
  const set = new Set(days);
  const todayDone = set.has(today);
  let cursor = todayDone ? today : addDays(today, -1);
  let count = 0;
  while (set.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return { days: count, todayDone };
}

@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);
  private boardCache = new Map<string, { at: number; rows: RewardLeaderRow[] }>();

  constructor(
    private readonly db: DataSource,
    private readonly settings: PlatformSettingsService,
    private readonly storage: StorageService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  private async enabled(): Promise<boolean> {
    return (await this.settings.getFeatures()).rewardsHub !== false;
  }

  private async assertEnabled(): Promise<void> {
    if (!(await this.enabled())) throw new ForbiddenException('The rewards hub is switched off');
  }

  private async streakBonusXp(): Promise<number> {
    const [row] = await this.db.query(`SELECT "rewardStreakBonusXp" AS xp FROM "platform_settings" LIMIT 1`);
    return Number(row?.xp ?? 200);
  }

  // --- Activity the pages report -----------------------------------------------------------

  async checkIn(userId: string): Promise<{ ok: true }> {
    if (!(await this.enabled())) return { ok: true };
    await this.recordVisit(userId, 'login');
    return { ok: true };
  }

  async visit(userId: string, page: string): Promise<{ ok: true }> {
    if (!(VISIT_PAGES as readonly string[]).includes(page)) throw new BadRequestException('Unknown page');
    if (!(await this.enabled())) return { ok: true };
    await this.recordVisit(userId, page);
    return { ok: true };
  }

  private async recordVisit(userId: string, page: string): Promise<void> {
    await this.db.query(`INSERT INTO "reward_visits" ("userId", "day", "page") VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [userId, tbilisiDay(Date.now()), page]);
  }

  // --- Progress ------------------------------------------------------------------------------

  // One query: how many qualifying rows of each trigger the user has in [from, to) (null = all time).
  private async counts(userId: string, from: Date | null, to: Date | null): Promise<Record<RewardTrigger, number>> {
    // `in(alias)` = the row's createdAt falls in the window (null bounds = open).
    const inW = (a: string) => `(w.f IS NULL OR ${a}."createdAt" >= w.f) AND (w.t IS NULL OR ${a}."createdAt" < w.t)`;
    const visit = (page: string) => `(SELECT count(*) FROM "reward_visits" v, w WHERE v."userId" = $1 AND v."page" = '${page}' AND ${inW('v')})::int`;
    // Orders the buyer really paid for (not cancelled / refunded / unpaid).
    const bought = (extra: string) =>
      `(SELECT count(*) FROM "orders" o JOIN "listings" l ON l."id" = o."listingId" LEFT JOIN "categories" c ON c."id" = l."categoryId", w
        WHERE o."buyerId" = $1 AND o."status" NOT IN ('pending_payment', 'cancelled', 'refunded', 'expired') AND ${inW('o')} ${extra})::int`;
    const [row] = await this.db.query(
      `WITH w AS (SELECT $2::timestamptz AS f, $3::timestamptz AS t)
       SELECT
         ${visit('login')} AS "login",
         ${visit('marketplace')} AS "visit_marketplace",
         ${visit('services')} AS "visit_services",
         ${visit('steam')} AS "visit_steam",
         ${visit('tournaments')} AS "visit_tournaments",
         ${visit('coaching')} AS "visit_coaching",
         ${bought('')} AS "purchase",
         ${bought(`AND c."slug" = 'skins'`)} AS "buy_skin",
         ${bought(`AND c."slug" = 'accounts'`)} AS "buy_account",
         ${bought(`AND c."slug" = 'items'`)} AS "buy_game_item",
         ${bought(`AND o."listingType" = 'digital_key'`)} AS "buy_steam_key",
         ${bought(`AND o."listingType" = 'service'`)} AS "buy_service",
         (SELECT COALESCE(floor(sum(COALESCE(o."buyerTotalWaveCoin", o."priceWaveCoin"))), 0) FROM "orders" o, w WHERE o."buyerId" = $1 AND o."status" NOT IN ('pending_payment', 'cancelled', 'refunded', 'expired') AND ${inW('o')})::int AS "spend_amount",
         (SELECT count(*) FROM "orders" o, w WHERE o."buyerId" = $1 AND o."status" = 'completed' AND (w.f IS NULL OR o."completedAt" >= w.f) AND (w.t IS NULL OR o."completedAt" < w.t))::int AS "complete_order",
         (SELECT count(*) FROM "wallet_ledger_entries" e, w WHERE e."userId" = $1 AND e."type" = 'topup' AND e."amountWaveCoin" > 0 AND ${inW('e')})::int AS "topup",
         (SELECT COALESCE(floor(sum(e."amountWaveCoin")), 0) FROM "wallet_ledger_entries" e, w WHERE e."userId" = $1 AND e."type" = 'topup' AND e."amountWaveCoin" > 0 AND ${inW('e')})::int AS "topup_amount",
         (SELECT count(*) FROM "promo_redemptions" pr, w WHERE pr."userId" = $1 AND ${inW('pr')})::int AS "redeem_promo",
         (SELECT count(*) FROM "listing_favorites" lf, w WHERE lf."userId" = $1 AND ${inW('lf')})::int AS "favorite_listing",
         (SELECT count(*) FROM "coach_favorites" cf, w WHERE cf."userId" = $1 AND ${inW('cf')})::int AS "favorite_coach",
         (SELECT count(*) FROM "user_follows" uf, w WHERE uf."followerId" = $1 AND ${inW('uf')})::int AS "follow",
         (SELECT count(*) FROM "user_follows" uf JOIN "coaches" c ON c."userId" = uf."followeeId" AND c."verificationStatus" = 'verified', w WHERE uf."followerId" = $1 AND ${inW('uf')})::int AS "follow_coach",
         (SELECT count(*) FROM "messages" m, w WHERE m."senderId" = $1 AND ${inW('m')})::int AS "send_message",
         (SELECT count(*) FROM "reviews" r, w WHERE r."buyerId" = $1 AND ${inW('r')})::int AS "review",
         (SELECT count(*) FROM "coaching_session_reviews" sr, w WHERE sr."buyerId" = $1 AND ${inW('sr')})::int AS "review_coach",
         (SELECT count(*) FROM "coaching_sessions" cs, w WHERE cs."buyerId" = $1 AND cs."status" <> 'cancelled' AND ${inW('cs')})::int AS "book_session",
         (SELECT count(*) FROM "coaching_sessions" cs, w WHERE cs."buyerId" = $1 AND cs."status" = 'completed' AND (w.f IS NULL OR cs."completedAt" >= w.f) AND (w.t IS NULL OR cs."completedAt" < w.t))::int AS "complete_session",
         (SELECT count(*) FROM "tournament_teams" tt, w WHERE (tt."captainUserId" = $1 OR EXISTS (SELECT 1 FROM "tournament_team_members" m WHERE m."teamId" = tt."id" AND m."userId" = $1)) AND ${inW('tt')})::int AS "tournament_join",
         (SELECT count(*) FROM "listings" l, w WHERE l."sellerId" = $1 AND ${inW('l')})::int AS "list_item",
         (SELECT count(*) FROM "orders" o, w WHERE o."sellerId" = $1 AND o."status" = 'completed' AND (w.f IS NULL OR o."completedAt" >= w.f) AND (w.t IS NULL OR o."completedAt" < w.t))::int AS "sell"`,
      [userId, from, to],
    );
    return row as Record<RewardTrigger, number>;
  }

  private async activeTasks(): Promise<TaskRow[]> {
    return this.db.query(`SELECT * FROM "reward_tasks" WHERE "isActive" = true ORDER BY "sortOrder" ASC, "createdAt" ASC`);
  }

  private async credit(userId: string, key: string, taskId: string | null, title: string, xp: number): Promise<boolean> {
    const rows = await this.db.query(
      `INSERT INTO "reward_xp" ("userId", "key", "taskId", "title", "xp") VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("userId", "key") DO NOTHING RETURNING "id"`,
      [userId, key, taskId, title.slice(0, 80), xp],
    );
    return rows.length > 0;
  }

  // --- The hub -------------------------------------------------------------------------------

  async hub(userId: string): Promise<RewardHub> {
    const now = Date.now();
    const today = tbilisiDay(now);
    const yesterday = addDays(today, -1);
    const weekStart = weekStartOf(today);
    const enabled = await this.enabled();
    const resetsAt = dayStartUtc(addDays(today, 1)).toISOString();
    const weekEndsAt = dayStartUtc(addDays(weekStart, 7)).toISOString();
    if (!enabled) {
      return {
        enabled: false, today, resetsAt, weekStart, weekEndsAt,
        xp: { total: 0, week: 0, ...levelFor(0) }, streak: { days: 0, todayDone: false, position: 0, bonusXp: 0 },
        daily: [], achievements: [], leaderboard: [], me: { place: null, xp: 0 }, prizes: [], wins: [], justEarned: [],
      };
    }

    // Opening the hub is a visit too.
    await this.recordVisit(userId, 'login');
    const justEarned: Array<{ title: string; xp: number }> = [];
    const tasks = await this.activeTasks();
    const dailyTasks = tasks.filter((t) => t.period === 'daily');
    const onceTasks = tasks.filter((t) => t.period === 'once');

    const [todayCounts, yesterdayCounts, allCounts] = await Promise.all([
      dailyTasks.length ? this.counts(userId, dayStartUtc(today), dayStartUtc(addDays(today, 1))) : null,
      dailyTasks.length ? this.counts(userId, dayStartUtc(yesterday), dayStartUtc(today)) : null,
      onceTasks.length ? this.counts(userId, null, null) : null,
    ]);

    // Which tasks are done (for the check marks), from the ledger — by task id, so editing a task
    // (title, target, trigger, even daily ↔ once) never turns a finished task back into a to-do.
    // Daily: a credit for today's Tbilisi day; once: any credit ever.
    const claimed: Array<{ taskId: string; key: string; createdAt: Date }> = await this.db.query(
      `SELECT "taskId", "key", "createdAt" FROM "reward_xp" WHERE "userId" = $1 AND "taskId" IS NOT NULL`,
      [userId],
    );
    const doneToday = new Set<string>();
    const doneEver = new Set<string>();
    const dayStart = dayStartUtc(today).getTime();
    for (const r of claimed) {
      doneEver.add(r.taskId);
      if (r.key.endsWith(`:${today}`) || (r.key.endsWith(':once') && new Date(r.createdAt).getTime() >= dayStart)) doneToday.add(r.taskId);
    }
    for (const task of dailyTasks) {
      if (yesterdayCounts && yesterdayCounts[task.trigger] >= task.target) {
        await this.credit(userId, `task:${task.id}:${yesterday}`, task.id, task.title, task.xp);
      }
      if (doneToday.has(task.id)) continue;
      if (todayCounts && todayCounts[task.trigger] >= task.target && (await this.credit(userId, `task:${task.id}:${today}`, task.id, task.title, task.xp))) {
        justEarned.push({ title: task.title, xp: task.xp });
        doneToday.add(task.id);
        doneEver.add(task.id);
      }
    }
    for (const task of onceTasks) {
      if (doneEver.has(task.id)) continue;
      if (allCounts && allCounts[task.trigger] >= task.target && (await this.credit(userId, `task:${task.id}:once`, task.id, task.title, task.xp))) {
        justEarned.push({ title: task.title, xp: task.xp });
        doneEver.add(task.id);
      }
    }

    // Streak: consecutive check-in days; every 7th day pays the bonus once.
    const visitRows: Array<{ day: string }> = await this.db.query(
      `SELECT to_char("day", 'YYYY-MM-DD') AS day FROM "reward_visits" WHERE "userId" = $1 AND "page" = 'login' AND "day" > $2::date ORDER BY "day" DESC`,
      [userId, addDays(today, -400)],
    );
    const streak = streakFrom(visitRows.map((r) => r.day), today);
    const bonusXp = await this.streakBonusXp();
    if (streak.todayDone && streak.days > 0 && streak.days % 7 === 0 && bonusXp > 0) {
      if (await this.credit(userId, `streak:${today}`, null, '7-Day Streak Reward', bonusXp)) {
        justEarned.push({ title: '7-Day Streak Reward', xp: bonusXp });
        void this.notifications?.tryEmit(userId, NotificationType.RewardStreak, '7 დღიანი Streak! 🔥', `+${bonusXp} XP დაგერიცხა.`, { link: '/hub' });
      }
    }
    const position = streak.todayDone ? ((streak.days - 1) % 7) + 1 : streak.days % 7;

    const view = (task: TaskRow, counts: Record<RewardTrigger, number> | null): RewardTaskView => {
      const done = task.period === 'daily' ? doneToday.has(task.id) : doneEver.has(task.id);
      return {
        id: task.id, title: task.title, description: task.description, trigger: task.trigger, target: task.target, xp: task.xp, period: task.period,
        progress: done ? task.target : Math.min(task.target, counts?.[task.trigger] ?? 0),
        done,
      };
    };

    const [totals] = await this.db.query(
      `SELECT COALESCE(sum("xp"), 0)::int AS total, COALESCE(sum("xp") FILTER (WHERE "createdAt" >= $2), 0)::int AS week FROM "reward_xp" WHERE "userId" = $1`,
      [userId, dayStartUtc(weekStart)],
    );
    const leaderboard = await this.leaderboard(weekStart);
    const me = await this.myPlace(userId, weekStart, Number(totals.week));

    return {
      enabled: true,
      today,
      resetsAt,
      weekStart,
      weekEndsAt,
      xp: { total: Number(totals.total), week: Number(totals.week), ...levelFor(Number(totals.total)) },
      streak: { days: streak.days, todayDone: streak.todayDone, position, bonusXp },
      daily: dailyTasks.map((t) => view(t, todayCounts)),
      achievements: onceTasks.map((t) => view(t, allCounts)),
      leaderboard,
      me,
      prizes: await this.prizes(),
      wins: await this.myWins(userId),
      justEarned,
    };
  }

  // Weekly XP top 10 — active, non-staff accounts only (staff can't win their own prizes).
  async leaderboard(weekStart: string): Promise<RewardLeaderRow[]> {
    const hit = this.boardCache.get(weekStart);
    if (hit && Date.now() - hit.at < LEADERBOARD_TTL_MS) return hit.rows;
    // userId stays server-side.
    const rows = (await this.weekRanking(weekStart, LEADERBOARD_SIZE)).map(({ userId, ...row }) => (void userId, row));
    this.boardCache.set(weekStart, { at: Date.now(), rows });
    return rows;
  }

  private async weekRanking(weekStart: string, limit: number): Promise<Array<RewardLeaderRow & { userId: string }>> {
    const rows: Array<{ userId: string; username: string; firstName: string | null; lastName: string | null; avatarUrl: string | null; verified: boolean; xp: number }> = await this.db.query(
      `SELECT x."userId", u."username", u."firstName", u."lastName", u."avatarUrl", sum(x."xp")::int AS xp,
         EXISTS (SELECT 1 FROM "user_badges" b WHERE b."userId" = u."id" AND b."badgeKey" = 'verified') AS verified
       FROM "reward_xp" x JOIN "users" u ON u."id" = x."userId" AND u."status" = 'active' AND u."adminRole" IS NULL
       WHERE x."createdAt" >= $1 AND x."createdAt" < $2
       GROUP BY x."userId", u."id"
       HAVING sum(x."xp") > 0
       ORDER BY xp DESC, max(x."createdAt") ASC
       LIMIT $3`,
      [dayStartUtc(weekStart), dayStartUtc(addDays(weekStart, 7)), limit],
    );
    return rows.map((r, i) => ({
      place: i + 1,
      userId: r.userId,
      username: r.username,
      firstName: r.firstName ?? '',
      lastName: r.lastName ?? '',
      avatarUrl: r.avatarUrl,
      verified: !!r.verified,
      xp: Number(r.xp),
    }));
  }

  private async myPlace(userId: string, weekStart: string, xp: number): Promise<{ place: number | null; xp: number }> {
    if (xp <= 0) return { place: null, xp: 0 };
    const [row] = await this.db.query(
      `SELECT count(*)::int AS ahead FROM (
         SELECT x."userId" FROM "reward_xp" x JOIN "users" u ON u."id" = x."userId" AND u."status" = 'active' AND u."adminRole" IS NULL
         WHERE x."createdAt" >= $1 AND x."createdAt" < $2 AND x."userId" <> $3
         GROUP BY x."userId" HAVING sum(x."xp") > $4
       ) s`,
      [dayStartUtc(weekStart), dayStartUtc(addDays(weekStart, 7)), userId, xp],
    );
    const [staff] = await this.db.query(`SELECT ("adminRole" IS NOT NULL OR "status" <> 'active') AS out FROM "users" WHERE "id" = $1`, [userId]);
    return { place: staff?.out ? null : Number(row.ahead) + 1, xp };
  }

  async prizes(): Promise<RewardPrizeView[]> {
    const rows: Array<{ place: number; title: string; description: string | null; imageUrl: string | null }> = await this.db.query(
      `SELECT "place", "title", "description", "imageUrl" FROM "reward_prizes" ORDER BY "place"`,
    );
    return rows.map((r) => ({ place: Number(r.place), title: r.title, description: r.description, imageUrl: r.imageUrl }));
  }

  private winView(r: Record<string, unknown>): RewardWinView {
    return {
      id: r.id as string,
      weekStart: r.weekStart as string,
      place: Number(r.place),
      xp: Number(r.xp),
      prize: { place: Number(r.place), title: r.prizeTitle as string, description: (r.prizeDescription as string | null) ?? null, imageUrl: (r.prizeImageUrl as string | null) ?? null },
      openedAt: r.openedAt ? new Date(r.openedAt as string).toISOString() : null,
      deliveredAt: r.deliveredAt ? new Date(r.deliveredAt as string).toISOString() : null,
    };
  }

  private async myWins(userId: string): Promise<RewardWinView[]> {
    const rows = await this.db.query(
      `SELECT w.*, to_char(w."weekStart", 'YYYY-MM-DD') AS "weekStart" FROM "reward_wins" w WHERE w."userId" = $1 ORDER BY w."weekStart" DESC LIMIT 12`,
      [userId],
    );
    return rows.map((r: Record<string, unknown>) => this.winView(r));
  }

  // The winner opens their prize box (the animation is client-side); only the winner can.
  async openWin(userId: string, winId: string): Promise<RewardWinView> {
    const [row] = await this.db.query(`SELECT *, to_char("weekStart", 'YYYY-MM-DD') AS "weekStart" FROM "reward_wins" WHERE "id" = $1`, [winId]);
    if (!row || row.userId !== userId) throw new NotFoundException('Prize not found');
    await this.db.query(`UPDATE "reward_wins" SET "openedAt" = COALESCE("openedAt", now()) WHERE "id" = $1`, [winId]);
    const [fresh] = await this.db.query(`SELECT *, to_char("weekStart", 'YYYY-MM-DD') AS "weekStart" FROM "reward_wins" WHERE "id" = $1`, [winId]);
    return this.winView(fresh);
  }

  // --- Weekly prizes -------------------------------------------------------------------------

  // Hourly: once a week has ended, its top 3 get that week's prizes (snapshotted). The unique
  // (weekStart, place) makes this safe to run on several instances or twice.
  @Cron('7 * * * *')
  async finalizeLastWeek(): Promise<number> {
    try {
      if (!(await this.enabled())) return 0;
      const lastWeek = addDays(weekStartOf(tbilisiDay(Date.now())), -7);
      return await this.finalizeWeek(lastWeek);
    } catch (err) {
      this.logger.error('Weekly reward finalization failed', err as Error);
      return 0;
    }
  }

  async finalizeWeek(weekStart: string): Promise<number> {
    if (dayStartUtc(addDays(weekStart, 7)).getTime() > Date.now()) throw new BadRequestException('That week has not ended yet');
    const prizes = await this.prizes();
    if (prizes.length === 0) return 0;
    const top = await this.weekRanking(weekStart, 3);
    let created = 0;
    for (const prize of prizes) {
      const winner = top.find((r) => r.place === prize.place);
      if (!winner) continue;
      const rows = await this.db.query(
        `INSERT INTO "reward_wins" ("weekStart", "place", "userId", "xp", "prizeTitle", "prizeDescription", "prizeImageUrl")
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT ("weekStart", "place") DO NOTHING RETURNING "id"`,
        [weekStart, prize.place, winner.userId, winner.xp, prize.title, prize.description, prize.imageUrl],
      );
      if (rows.length === 0) continue;
      created += 1;
      await this.notifications?.tryEmit(
        winner.userId,
        NotificationType.RewardWeeklyPrize,
        `🎁 კვირის Top ${prize.place}! გახსენი პრიზის ყუთი`,
        `${winner.xp.toLocaleString('en-US')} XP-ით ${prize.place} ადგილი დაიკავე. პრიზი: ${prize.title}.`,
        { link: '/hub#rewards' },
      );
      await this.notifications?.notifyStaff(
        REWARD_STAFF_ROLES,
        'კვირის პრიზის გამარჯვებული',
        `@${winner.username} — ${prize.place} ადგილი (${prize.title}). გადაეცით პრიზი და მონიშნეთ „გადაცემულია“.`,
        '/admin/rewards#winners',
        `reward_win:${weekStart}:${prize.place}`,
      );
    }
    return created;
  }

  // --- Admin -------------------------------------------------------------------------------

  async adminOverview(): Promise<AdminRewards> {
    const tasks: Array<TaskRow & { completions: number }> = await this.db.query(
      `SELECT t.*, (SELECT count(*) FROM "reward_xp" x WHERE x."taskId" = t."id")::int AS completions
       FROM "reward_tasks" t ORDER BY t."period" ASC, t."sortOrder" ASC, t."createdAt" ASC`,
    );
    const winners = await this.db.query(
      `SELECT w.*, to_char(w."weekStart", 'YYYY-MM-DD') AS "weekStart", u."username", u."firstName", u."lastName"
       FROM "reward_wins" w JOIN "users" u ON u."id" = w."userId" ORDER BY w."weekStart" DESC, w."place" ASC LIMIT 60`,
    );
    return {
      tasks: tasks.map(
        (t): AdminRewardTask => ({
          id: t.id, title: t.title, description: t.description, trigger: t.trigger, target: t.target, xp: t.xp, period: t.period,
          isActive: t.isActive, sortOrder: t.sortOrder, completions: Number(t.completions),
        }),
      ),
      prizes: await this.prizes(),
      streakBonusXp: await this.streakBonusXp(),
      enabled: await this.enabled(),
      winners: winners.map(
        (w: Record<string, unknown>): AdminRewardWinner => ({ ...this.winView(w), username: w.username as string, firstName: (w.firstName as string) ?? '', lastName: (w.lastName as string) ?? '' }),
      ),
      leaderboard: await this.leaderboard(weekStartOf(tbilisiDay(Date.now()))),
    };
  }

  async saveTask(dto: RewardTaskDto, id?: string): Promise<{ id: string }> {
    const values = [dto.title.trim(), dto.description?.trim() || null, dto.trigger, dto.target, dto.xp, dto.period, dto.isActive ?? true, dto.sortOrder ?? 0];
    if (id) {
      const rows = await this.db.query(
        `UPDATE "reward_tasks" SET "title" = $1, "description" = $2, "trigger" = $3, "target" = $4, "xp" = $5, "period" = $6, "isActive" = $7, "sortOrder" = $8, "updatedAt" = now()
         WHERE "id" = $9 RETURNING "id"`,
        [...values, id],
      );
      if (updatedCount(rows) === 0) throw new NotFoundException('Task not found');
      return { id };
    }
    const [row] = await this.db.query(
      `INSERT INTO "reward_tasks" ("title", "description", "trigger", "target", "xp", "period", "isActive", "sortOrder") VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING "id"`,
      values,
    );
    return { id: row.id };
  }

  // Deleting keeps the XP people already earned (the ledger row's taskId becomes NULL).
  async deleteTask(id: string): Promise<{ ok: true }> {
    await this.db.query(`DELETE FROM "reward_tasks" WHERE "id" = $1`, [id]);
    return { ok: true };
  }

  async savePrize(place: number, title: string, description: string | null): Promise<RewardPrizeView[]> {
    if (![1, 2, 3].includes(place)) throw new BadRequestException('Place must be 1, 2 or 3');
    if (!title.trim()) {
      await this.db.query(`DELETE FROM "reward_prizes" WHERE "place" = $1`, [place]);
    } else {
      await this.db.query(
        `INSERT INTO "reward_prizes" ("place", "title", "description") VALUES ($1, $2, $3)
         ON CONFLICT ("place") DO UPDATE SET "title" = EXCLUDED."title", "description" = EXCLUDED."description", "updatedAt" = now()`,
        [place, title.trim(), description?.trim() || null],
      );
    }
    return this.prizes();
  }

  async setPrizeImage(place: number, file: UploadedImage | undefined): Promise<RewardPrizeView[]> {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!IMAGE_TYPES.includes(file.mimetype)) throw new ForbiddenException('Only JPG, PNG, or WEBP images are allowed');
    if (file.size > 2 * 1024 * 1024) throw new ForbiddenException('Image must be 2MB or smaller');
    const [exists] = await this.db.query(`SELECT 1 FROM "reward_prizes" WHERE "place" = $1`, [place]);
    if (!exists) throw new NotFoundException('Save the prize title first');
    const stored = await this.storage.save(file.buffer, file.originalname, 'image');
    await this.db.query(`UPDATE "reward_prizes" SET "imageUrl" = $2, "updatedAt" = now() WHERE "place" = $1`, [place, stored.url]);
    return this.prizes();
  }

  async saveSettings(patch: { streakBonusXp?: number; enabled?: boolean }): Promise<{ ok: true }> {
    if (patch.streakBonusXp !== undefined) await this.db.query(`UPDATE "platform_settings" SET "rewardStreakBonusXp" = $1`, [patch.streakBonusXp]);
    if (patch.enabled !== undefined) await this.settings.setFeatures({ rewardsHub: patch.enabled });
    return { ok: true };
  }

  async setDelivered(winId: string, delivered: boolean): Promise<{ ok: true }> {
    const rows = await this.db.query(`UPDATE "reward_wins" SET "deliveredAt" = ${delivered ? 'COALESCE("deliveredAt", now())' : 'NULL'} WHERE "id" = $1 RETURNING "id"`, [winId]);
    if (updatedCount(rows) === 0) throw new NotFoundException('Winner not found');
    return { ok: true };
  }
}
