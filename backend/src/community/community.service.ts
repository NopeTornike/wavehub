import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { WAVE_RANK_TIERS } from '@wavehub/shared-types';
import type { GameListingCount, OnlineStats, WaveRank } from '@wavehub/shared-types';

// Accounts that made an authenticated request within this window count as "online".
export const ONLINE_WINDOW_MINUTES = 5;

// Mirrors the static prototype's profile-nav.js `getWaveRankMetrics` weights exactly — the only
// difference is the inputs: real listings/orders/reviews rows instead of localStorage.
const WEIGHTS = { listing: 15, sold: 60, bought: 20, review: 25, recentEvent: 75 };
const PROGRESS_CAP = 500;
const ACTIVITY_CAP = 500;
const SCORE_CAP = 1000;

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

@Injectable()
export class CommunityService {
  constructor(private readonly db: DataSource) {}

  async onlineStats(): Promise<OnlineStats> {
    const [row] = await this.db.query(
      `SELECT count(*)::int AS count FROM "users"
       WHERE "lastSeenAt" > now() - make_interval(mins => $1) AND "status" IN ('active', 'pending_verification')`,
      [ONLINE_WINDOW_MINUTES],
    );
    return { count: row?.count ?? 0 };
  }

  async gameListingCounts(): Promise<GameListingCount[]> {
    const rows: Array<{ gameId: string; slug: string; name: string; count: number }> = await this.db.query(
      `SELECT g."id" AS "gameId", g."slug", g."name", count(l."id")::int AS "count"
       FROM "games" g
       LEFT JOIN "listings" l ON l."gameId" = g."id" AND l."status" = 'active'
       WHERE g."isActive" = true
       GROUP BY g."id"
       ORDER BY g."sortOrder" ASC, g."name" ASC`,
    );
    return rows.map((row) => ({ gameId: row.gameId, slug: row.slug, name: row.name, activeListingCount: row.count }));
  }

  async waveRank(userId: string): Promise<WaveRank> {
    const [row] = await this.db.query(
      `SELECT
         (SELECT count(*) FROM "listings" WHERE "sellerId" = $1 AND "status" IN ('active', 'paused'))::int AS listings,
         (SELECT count(*) FROM "orders" WHERE "sellerId" = $1 AND "status" = 'completed')::int AS sold,
         (SELECT count(*) FROM "orders" WHERE "buyerId" = $1 AND "status" = 'completed')::int AS bought,
         (SELECT count(*) FROM "reviews" WHERE "sellerId" = $1 AND "status" = 'published')::int AS reviews,
         (
           (SELECT count(*) FROM "listings" WHERE "sellerId" = $1 AND "createdAt" > now() - interval '30 days')
           + (SELECT count(*) FROM "orders" WHERE ("sellerId" = $1 OR "buyerId" = $1) AND "status" = 'completed' AND "completedAt" > now() - interval '30 days')
           + (SELECT count(*) FROM "reviews" WHERE "sellerId" = $1 AND "status" = 'published' AND "createdAt" > now() - interval '30 days')
         )::int AS "recentEvents"`,
      [userId],
    );
    return computeWaveRank(row);
  }
}
