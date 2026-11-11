import { Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { WAVE_RANK_TIERS } from '@wavehub/shared-types';
import type {
  GameListingCount,
  OnlineStats,
  SellerLeaderboard,
  SellerLeaderboardPeriod,
  SellerLeaderboardRow,
  SellerLeaderboardSort,
  SellerRanks,
  WaveRank,
} from '@wavehub/shared-types';
import { PlatformSettingsService } from '../settings/platform-settings.service';

// Accounts that made an authenticated request within this window count as "online".
export const ONLINE_WINDOW_MINUTES = 5;

// Mirrors the static prototype's profile-nav.js `getWaveRankMetrics` weights exactly — the only
// difference is the inputs: real listings/orders/reviews rows instead of localStorage.
const WEIGHTS = { listing: 15, sold: 60, bought: 20, review: 25, recentEvent: 75 };
// Promotion now needs three times the earned activity. The underlying actions retain their
// readable weights; tier thresholds and their matching caps are tripled instead.
const PROGRESS_CAP = 1500;
const ACTIVITY_CAP = 1500;
const SCORE_CAP = 3000;

export function computeWaveRank(counts: {
  listings: number;
  sold: number;
  bought: number;
  reviews: number;
  recentEvents: number;
}): WaveRank {
  const progress = Math.min(
    PROGRESS_CAP,
    counts.listings * WEIGHTS.listing + counts.sold * WEIGHTS.sold + counts.bought * WEIGHTS.bought + counts.reviews * WEIGHTS.review,
  );
  const activity = Math.min(ACTIVITY_CAP, counts.recentEvents * WEIGHTS.recentEvent);
  const score = Math.min(SCORE_CAP, progress + activity);
  const tierIndex = WAVE_RANK_TIERS.reduce((current, [, threshold], index) => (score >= threshold ? index : current), 0);
  const [name, threshold] = WAVE_RANK_TIERS[tierIndex];
  const nextTier = WAVE_RANK_TIERS[tierIndex + 1];
  const nextThreshold = nextTier?.[1] ?? SCORE_CAP;
  return {
    score,
    tierIndex,
    name,
    nextName: nextTier?.[0] ?? name,
    level: tierIndex + 1,
    progressToNext: nextThreshold === threshold ? 100 : Math.round(((score - threshold) / (nextThreshold - threshold)) * 100),
  };
}

// Seller ranks change slowly and every marketplace page view asks for them, so they're computed at
// most once per SELLER_RANK_TTL_MS per process.
const SELLER_RANK_TTL_MS = 60_000;

@Injectable()
export class CommunityService {
  private sellerRankCache: { at: number; value: SellerRanks } | null = null;

  private sellerTierCache?: { at: number; value: Record<string, string> };

  private leaderboardCache = new Map<string, { at: number; value: Omit<SellerLeaderboard, 'visible'> }>();

  constructor(
    private readonly db: DataSource,
    @Optional() private readonly settings?: PlatformSettingsService,
  ) {}

  // Marketplace sellers leaderboard (owner 2026-11-10, round-6/03): top 5 by the chosen tab plus
  // site-wide totals for the same period. One cached SQL per (sort, period) for 60s, so a busy
  // marketplace costs at most a handful of queries a minute. Off → { visible: false } and no query.
  async sellerLeaderboard(sort: SellerLeaderboardSort, period: SellerLeaderboardPeriod): Promise<SellerLeaderboard> {
    const features = this.settings ? await this.settings.getFeatures() : null;
    if (features && !features.sellerLeaderboard) {
      return { visible: false, sort, period, rows: [], totals: { products: 0, sales: 0, rating: null, ratingCount: 0 } };
    }
    const key = `${sort}:${period}`;
    const hit = this.leaderboardCache.get(key);
    if (hit && Date.now() - hit.at < SELLER_RANK_TTL_MS) return { visible: true, ...hit.value };

    const days = period === '7d' ? 7 : period === '30d' ? 30 : null;
    // $1 = start of the period (NULL = all time).
    const since = days ? new Date(Date.now() - days * 86_400_000) : null;
    const order =
      sort === 'products'
        ? 'products DESC, sales DESC, rating DESC NULLS LAST'
        : sort === 'sales'
          ? 'sales DESC, products DESC, rating DESC NULLS LAST'
          : sort === 'rating'
            ? 'rating DESC NULLS LAST, "ratingCount" DESC, sales DESC'
            : 'sales DESC, "ratingCount" DESC, products DESC, rating DESC NULLS LAST';
    // "Highest rating" ranks only sellers who have a rating in the period.
    const where = sort === 'rating' ? '"ratingCount" > 0' : '(products > 0 OR sales > 0 OR "ratingCount" > 0)';
    const rows: Array<{
      id: string;
      username: string;
      firstName: string | null;
      lastName: string | null;
      avatarUrl: string | null;
      verified: boolean;
      products: number;
      sales: number;
      rating: string | null;
      ratingCount: number;
    }> = await this.db.query(
      `WITH p AS (
         SELECT l."sellerId" AS id, count(*)::int AS n FROM "listings" l
         WHERE l."status" = 'active' AND l."type" <> 'digital_key' GROUP BY 1
       ), s AS (
         SELECT o."sellerId" AS id, count(*)::int AS n FROM "orders" o
         JOIN "listings" l ON l."id" = o."listingId" AND l."type" <> 'digital_key'
         WHERE o."status" = 'completed' AND ($1::timestamptz IS NULL OR o."completedAt" >= $1) GROUP BY 1
       ), r AS (
         SELECT rv."sellerId" AS id, count(*)::int AS n, avg(rv."rating")::numeric(4,2) AS avg FROM "reviews" rv
         WHERE rv."status" = 'published' AND ($1::timestamptz IS NULL OR rv."createdAt" >= $1) GROUP BY 1
       ), stats AS (
         SELECT u."id", u."username", u."firstName", u."lastName", u."avatarUrl",
           COALESCE(p.n, 0) AS products, COALESCE(s.n, 0) AS sales, r.avg AS rating, COALESCE(r.n, 0) AS "ratingCount"
         FROM "users" u
         LEFT JOIN p ON p.id = u."id" LEFT JOIN s ON s.id = u."id" LEFT JOIN r ON r.id = u."id"
         WHERE u."status" = 'active' AND (p.id IS NOT NULL OR s.id IS NOT NULL OR r.id IS NOT NULL)
       )
       SELECT stats.*, EXISTS (SELECT 1 FROM "user_badges" b WHERE b."userId" = stats."id" AND b."badgeKey" = 'verified') AS verified
       FROM stats WHERE ${where}
       ORDER BY ${order}, "username" ASC
       LIMIT 5`,
      [since],
    );
    const [totals]: Array<{ products: number; sales: number; rating: string | null; ratingCount: number }> = await this.db.query(
      `SELECT
         (SELECT count(*) FROM "listings" l JOIN "users" u ON u."id" = l."sellerId" AND u."status" = 'active'
            WHERE l."status" = 'active' AND l."type" <> 'digital_key')::int AS products,
         (SELECT count(*) FROM "orders" o JOIN "listings" l ON l."id" = o."listingId" AND l."type" <> 'digital_key'
            WHERE o."status" = 'completed' AND ($1::timestamptz IS NULL OR o."completedAt" >= $1))::int AS sales,
         (SELECT avg("rating")::numeric(4,2) FROM "reviews" WHERE "status" = 'published' AND ($1::timestamptz IS NULL OR "createdAt" >= $1)) AS rating,
         (SELECT count(*) FROM "reviews" WHERE "status" = 'published' AND ($1::timestamptz IS NULL OR "createdAt" >= $1))::int AS "ratingCount"`,
      [since],
    );
    const value: Omit<SellerLeaderboard, 'visible'> = {
      sort,
      period,
      rows: rows.map(
        (row, index): SellerLeaderboardRow => ({
          rank: index + 1,
          username: row.username,
          firstName: row.firstName ?? '',
          lastName: row.lastName ?? '',
          avatarUrl: row.avatarUrl,
          verified: !!row.verified,
          products: Number(row.products),
          sales: Number(row.sales),
          rating: row.rating === null ? null : Number(row.rating),
          ratingCount: Number(row.ratingCount),
        }),
      ),
      totals: {
        products: totals?.products ?? 0,
        sales: totals?.sales ?? 0,
        rating: totals?.rating == null ? null : Number(totals.rating),
        ratingCount: totals?.ratingCount ?? 0,
      },
    };
    this.leaderboardCache.set(key, { at: Date.now(), value });
    return { visible: true, ...value };
  }

  // The prototype's getMarketplaceSellerWaveRank ordering: completed sales, then published reviews
  // received, then active listings, then average rating, then username — over every account that
  // has at least one of the three. Position 1 = top seller.
  async sellerRanks(): Promise<SellerRanks> {
    if (this.sellerRankCache && Date.now() - this.sellerRankCache.at < SELLER_RANK_TTL_MS) {
      return this.sellerRankCache.value;
    }
    const rows: Array<{ username: string }> = await this.db.query(`
      WITH stats AS (
        SELECT u."id", u."username",
          (SELECT count(*) FROM "orders" o WHERE o."sellerId" = u."id" AND o."status" = 'completed') AS sold,
          (SELECT count(*) FROM "reviews" r WHERE r."sellerId" = u."id" AND r."status" = 'published' AND r."orderId" IS NOT NULL) AS reviews,
          (SELECT count(*) FROM "listings" l WHERE l."sellerId" = u."id" AND l."status" = 'active') AS listings,
          COALESCE(u."sellerRatingAvg", 0) AS rating
        FROM "users" u
        WHERE u."status" = 'active'
      )
      SELECT "username" FROM stats
      WHERE sold > 0 OR reviews > 0 OR listings > 0
      ORDER BY sold DESC, reviews DESC, listings DESC, rating DESC, "username" ASC
    `);
    const value: SellerRanks = {};
    rows.forEach((row, index) => {
      value[row.username] = index + 1;
    });
    this.sellerRankCache = { at: Date.now(), value };
    return value;
  }

  // Each seller's Wave rank tier name (same formula as waveRank, batched) for the marketplace cards
  // (client 2026-10-07 design: "Avtandil Merabishvili · WaveHubX Apex"). Sellers with an active
  // listing only; cached like sellerRanks.
  async sellerTiers(): Promise<Record<string, string>> {
    if (this.sellerTierCache && Date.now() - this.sellerTierCache.at < SELLER_RANK_TTL_MS) {
      return this.sellerTierCache.value;
    }
    const rows: Array<{ username: string; listings: number; sold: number; bought: number; reviews: number; recentEvents: number }> = await this.db.query(`
      WITH sellers AS (
        SELECT DISTINCT u."id", u."username" FROM "users" u
        JOIN "listings" l ON l."sellerId" = u."id" AND l."status" = 'active'
        WHERE u."status" = 'active'
      ), coach AS (SELECT c."id", c."userId" FROM "coaches" c WHERE c."userId" IN (SELECT "id" FROM sellers))
      SELECT s."username",
        (SELECT count(*) FROM "listings" WHERE "sellerId" = s."id" AND "status" IN ('active', 'paused'))::int AS listings,
        ((SELECT count(*) FROM "orders" WHERE "sellerId" = s."id" AND "status" = 'completed')
          + (SELECT count(*) FROM "coaching_sessions" cs WHERE cs."coachId" IN (SELECT "id" FROM coach WHERE "userId" = s."id") AND cs."status" = 'completed'))::int AS sold,
        ((SELECT count(*) FROM "orders" WHERE "buyerId" = s."id" AND "status" = 'completed')
          + (SELECT count(*) FROM "coaching_sessions" WHERE "buyerId" = s."id" AND "status" = 'completed'))::int AS bought,
        ((SELECT count(*) FROM "reviews" WHERE "sellerId" = s."id" AND "status" = 'published' AND "orderId" IS NOT NULL)
          + (SELECT count(*) FROM "coaching_session_reviews" r WHERE r."coachId" IN (SELECT "id" FROM coach WHERE "userId" = s."id")))::int AS reviews,
        ((SELECT count(*) FROM "listings" WHERE "sellerId" = s."id" AND "createdAt" > now() - interval '30 days')
          + (SELECT count(*) FROM "orders" WHERE ("sellerId" = s."id" OR "buyerId" = s."id") AND "status" = 'completed' AND "completedAt" > now() - interval '30 days')
          + (SELECT count(*) FROM "reviews" WHERE "sellerId" = s."id" AND "status" = 'published' AND "orderId" IS NOT NULL AND "createdAt" > now() - interval '30 days')
          + (SELECT count(*) FROM "coaching_sessions" WHERE ("buyerId" = s."id" OR "coachId" IN (SELECT "id" FROM coach WHERE "userId" = s."id")) AND "status" = 'completed' AND "updatedAt" > now() - interval '30 days'))::int AS "recentEvents"
      FROM sellers s
    `);
    const value: Record<string, string> = {};
    for (const row of rows) value[row.username] = computeWaveRank(row).name;
    this.sellerTierCache = { at: Date.now(), value };
    return value;
  }

  async onlineStats(): Promise<OnlineStats> {
    const [row] = await this.db.query(
      `SELECT count(*)::int AS count FROM "users"
       WHERE "lastSeenAt" > now() - make_interval(mins => $1) AND "status" IN ('active', 'pending_verification')`,
      [ONLINE_WINDOW_MINUTES],
    );
    return { count: row?.count ?? 0 };
  }

  async gameListingCounts(): Promise<GameListingCount[]> {
    const rows: Array<{ gameId: string; slug: string; name: string; count: number; iconUrl: string | null; coverUrl: string | null; tileUrl: string | null }> = await this.db.query(
      `SELECT g."id" AS "gameId", g."slug", g."name", g."iconUrl", g."coverUrl", g."tileUrl", count(l."id")::int AS "count"
       FROM "games" g
       -- Marketplace products only (item listings): services live on /services, keys on /steam-keys.
       LEFT JOIN "listings" l ON l."gameId" = g."id" AND l."status" = 'active' AND l."type" = 'item'
        AND EXISTS (SELECT 1 FROM "users" su WHERE su."id" = l."sellerId" AND su."status" = 'active')
       WHERE g."isActive" = true
       GROUP BY g."id"
       ORDER BY g."sortOrder" ASC, g."name" ASC`,
    );
    return rows.map((row) => ({
      gameId: row.gameId,
      slug: row.slug,
      name: row.name,
      activeListingCount: row.count,
      iconUrl: row.iconUrl,
      coverUrl: row.coverUrl,
      tileUrl: row.tileUrl,
    }));
  }

  // Coaching counts like the marketplace: a completed session is a sale for the coach and a
  // purchase for the student, and a session review counts like a seller review.
  async waveRank(userId: string): Promise<WaveRank> {
    const [row] = await this.db.query(
      `WITH coach AS (SELECT "id" FROM "coaches" WHERE "userId" = $1)
       SELECT
         (SELECT count(*) FROM "listings" WHERE "sellerId" = $1 AND "status" IN ('active', 'paused'))::int AS listings,
         (
           (SELECT count(*) FROM "orders" WHERE "sellerId" = $1 AND "status" = 'completed')
           + (SELECT count(*) FROM "coaching_sessions" WHERE "coachId" IN (SELECT "id" FROM coach) AND "status" = 'completed')
         )::int AS sold,
         (
           (SELECT count(*) FROM "orders" WHERE "buyerId" = $1 AND "status" = 'completed')
           + (SELECT count(*) FROM "coaching_sessions" WHERE "buyerId" = $1 AND "status" = 'completed')
         )::int AS bought,
         (
           (SELECT count(*) FROM "reviews" WHERE "sellerId" = $1 AND "status" = 'published' AND "orderId" IS NOT NULL)
           + (SELECT count(*) FROM "coaching_session_reviews" WHERE "coachId" IN (SELECT "id" FROM coach))
         )::int AS reviews,
         (
           (SELECT count(*) FROM "listings" WHERE "sellerId" = $1 AND "createdAt" > now() - interval '30 days')
           + (SELECT count(*) FROM "orders" WHERE ("sellerId" = $1 OR "buyerId" = $1) AND "status" = 'completed' AND "completedAt" > now() - interval '30 days')
           + (SELECT count(*) FROM "reviews" WHERE "sellerId" = $1 AND "status" = 'published' AND "orderId" IS NOT NULL AND "createdAt" > now() - interval '30 days')
           + (SELECT count(*) FROM "coaching_sessions" WHERE ("buyerId" = $1 OR "coachId" IN (SELECT "id" FROM coach)) AND "status" = 'completed' AND "updatedAt" > now() - interval '30 days')
         )::int AS "recentEvents"`,
      [userId],
    );
    return computeWaveRank(row);
  }
}
