import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { ListingBadge } from '@wavehub/shared-types';
import { LISTING_BADGE_ORDER } from '@wavehub/shared-types';

// Automatic listing badges (owner 2026-10-28), every one computed from real rows — nothing is set by
// hand except VERIFIED (a staff check, audited):
//   HOT           ≥100 views AND ≥5 new favourites in the last 48 hours
//   MOST POPULAR  top 10 active listings by engagement in the last 30 days
//                 (views + 3 × favourites added + 10 × orders placed), score ≥ 50
//   MOST VIEWED   top 10 active listings by views in the last 30 days, at least 50 views
//   (the minimums keep a quiet marketplace from badging every listing that has a few views)
//   TRENDING      views in the last 24h ≥ 1.5 × the 24h before, with at least 20 views in the last
//                 24h (so 1 → 2 views isn't "trending")
//   PRICE DROP    the price was cut by ≥10% in the last 7 days and is still ≤90% of the old price
//   JUST UPDATED  the seller changed the listing's content in the last 48 hours (not its creation)
//   VERIFIED      staff verified the account / details (listings.verifiedAt)
// Views are counted per listing per hour (`listing_view_hours`) from the detail page; the two top-10
// lists are global, cached for 5 minutes.
const TOP_CACHE_MS = 5 * 60_000;

@Injectable()
export class ListingBadgesService {
  private readonly logger = new Logger(ListingBadgesService.name);
  private top: { at: number; popular: Set<string>; viewed: Set<string> } | null = null;
  // Who already counted for which listing this hour (so refreshing doesn't inflate HOT / TRENDING).
  private seen = new Map<string, number>();

  constructor(private readonly db: DataSource) {}

  // Best-effort: a failed count never breaks the page view. One count per visitor per listing per hour.
  recordView(listingId: string, viewer?: string): void {
    if (viewer) {
      const hour = Math.floor(Date.now() / 3_600_000);
      const key = `${listingId}|${viewer}`;
      if (this.seen.get(key) === hour) return;
      if (this.seen.size > 100_000) this.seen.clear();
      this.seen.set(key, hour);
    }
    this.db
      .query(
        `INSERT INTO "listing_view_hours" ("listingId", "hour", "views") VALUES ($1, date_trunc('hour', now()), 1)
         ON CONFLICT ("listingId", "hour") DO UPDATE SET "views" = "listing_view_hours"."views" + 1`,
        [listingId],
      )
      .catch((err: Error) => this.logger.warn(`view count failed: ${err.message}`));
  }

  private async topLists(): Promise<{ popular: Set<string>; viewed: Set<string> }> {
    if (this.top && Date.now() - this.top.at < TOP_CACHE_MS) return this.top;
    const viewed: Array<{ id: string }> = await this.db.query(
      `SELECT v."listingId" AS id
         FROM "listing_view_hours" v JOIN "listings" l ON l."id" = v."listingId" AND l."status" = 'active'
        WHERE v."hour" > now() - interval '30 days'
        GROUP BY v."listingId" HAVING sum(v."views") >= 50
        ORDER BY sum(v."views") DESC LIMIT 10`,
    );
    const popular: Array<{ id: string }> = await this.db.query(
      `SELECT l."id" AS id FROM "listings" l
         LEFT JOIN (SELECT "listingId", sum("views")::int AS n FROM "listing_view_hours" WHERE "hour" > now() - interval '30 days' GROUP BY 1) v ON v."listingId" = l."id"
         LEFT JOIN (SELECT "listingId", count(*)::int AS n FROM "listing_favorites" WHERE "createdAt" > now() - interval '30 days' GROUP BY 1) f ON f."listingId" = l."id"
         LEFT JOIN (SELECT "listingId", count(*)::int AS n FROM "orders" WHERE "createdAt" > now() - interval '30 days' GROUP BY 1) o ON o."listingId" = l."id"
        WHERE l."status" = 'active'
          AND coalesce(v.n, 0) + 3 * coalesce(f.n, 0) + 10 * coalesce(o.n, 0) >= 50
        ORDER BY coalesce(v.n, 0) + 3 * coalesce(f.n, 0) + 10 * coalesce(o.n, 0) DESC, l."createdAt" DESC
        LIMIT 10`,
    );
    this.top = { at: Date.now(), popular: new Set(popular.map((r) => r.id)), viewed: new Set(viewed.map((r) => r.id)) };
    return this.top;
  }

  async badgesFor(ids: string[]): Promise<Map<string, ListingBadge[]>> {
    const out = new Map<string, ListingBadge[]>();
    if (!ids.length) return out;
    try {
      const [top, rows] = await Promise.all([
        this.topLists(),
        this.db.query(
          `SELECT l."id",
                  coalesce((SELECT sum("views") FROM "listing_view_hours" WHERE "listingId" = l."id" AND "hour" > now() - interval '48 hours'), 0)::int AS v48,
                  coalesce((SELECT sum("views") FROM "listing_view_hours" WHERE "listingId" = l."id" AND "hour" > now() - interval '24 hours'), 0)::int AS v24,
                  coalesce((SELECT sum("views") FROM "listing_view_hours" WHERE "listingId" = l."id" AND "hour" > now() - interval '48 hours' AND "hour" <= now() - interval '24 hours'), 0)::int AS vprev,
                  (SELECT count(*) FROM "listing_favorites" WHERE "listingId" = l."id" AND "createdAt" > now() - interval '48 hours')::int AS f48,
                  (l."priceDroppedAt" > now() - interval '7 days' AND l."previousPriceWaveCoin" IS NOT NULL AND l."priceWaveCoin" <= l."previousPriceWaveCoin" * 0.9) AS dropped,
                  (l."contentUpdatedAt" > now() - interval '48 hours') AS updated,
                  (l."verifiedAt" IS NOT NULL) AS verified
             FROM "listings" l WHERE l."id" = ANY($1::uuid[])`,
          [ids],
        ) as Promise<Array<{ id: string; v48: number; v24: number; vprev: number; f48: number; dropped: boolean | null; updated: boolean | null; verified: boolean }>>,
      ]);
      for (const r of rows) {
        const earned = new Set<ListingBadge>();
        if (r.v48 >= 100 && r.f48 >= 5) earned.add('hot');
        if (top.popular.has(r.id)) earned.add('most_popular');
        if (top.viewed.has(r.id)) earned.add('most_viewed');
        if (r.v24 >= 20 && r.v24 >= 1.5 * r.vprev) earned.add('trending');
        if (r.dropped) earned.add('price_drop');
        if (r.updated) earned.add('just_updated');
        if (r.verified) earned.add('verified');
        out.set(r.id, LISTING_BADGE_ORDER.filter((b) => earned.has(b)));
      }
    } catch (err) {
      // Badges are decoration: a failure shows none rather than breaking the marketplace.
      this.logger.warn(`badges failed: ${(err as Error).message}`);
    }
    return out;
  }

  // Tests / staff actions that change a listing's standing can drop the cached top lists.
  resetCache(): void {
    this.top = null;
  }
}
