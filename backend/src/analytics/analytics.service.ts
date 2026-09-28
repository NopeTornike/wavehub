import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { AdminAnalytics, AnalyticsBreakdownRow, ListingType } from '@wavehub/shared-types';

const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 3660;
const DAILY_BUCKET_MAX_DAYS = 120;
// A "sale" is an order that was paid for: unpaid/expired checkouts never moved money.
const PAID = `o."status" NOT IN ('pending_payment', 'expired')`;
const KEPT = `o."status" NOT IN ('pending_payment', 'expired', 'cancelled', 'refunded')`;
const HELD = `o."status" IN ('paid', 'in_progress', 'delivered', 'disputed')`;

const int = (v: unknown) => Number(v ?? 0);

// Read-only sales/subscription/money statistics for the Super Admin dashboard. Everything is an
// aggregate over real rows (root CLAUDE.md rule 6); the only identities returned are seller
// usernames and listing titles, both already public. All SQL is parameterised.
@Injectable()
export class AnalyticsService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  resolveRange(fromRaw?: string, toRaw?: string): { from: Date; toExclusive: Date; bucket: 'day' | 'month' } {
    const parse = (value: string) => {
      const d = new Date(`${value}T00:00:00.000Z`);
      if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid date');
      return d;
    };
    const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
    const to = toRaw ? parse(toRaw) : today;
    const from = fromRaw ? parse(fromRaw) : new Date(to.getTime() - 29 * DAY_MS);
    if (from > to) throw new BadRequestException('from must be on or before to');
    const days = Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;
    if (days > MAX_RANGE_DAYS) throw new BadRequestException('Range is limited to 10 years');
    return { from, toExclusive: new Date(to.getTime() + DAY_MS), bucket: days <= DAILY_BUCKET_MAX_DAYS ? 'day' : 'month' };
  }

  async get(fromRaw?: string, toRaw?: string): Promise<AdminAnalytics> {
    const { from, toExclusive, bucket } = this.resolveRange(fromRaw, toRaw);
    const range = [from.toISOString(), toExclusive.toISOString()];
    const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = range) => this.db.query(sql, params) as Promise<T[]>;

    const [
      [sales],
      [escrow],
      byGame,
      byType,
      byCategory,
      topListings,
      topSellers,
      [coaching],
      [subs],
      [mrr],
      byPlan,
      [topups],
      [withdrawals],
      [users],
      series,
    ] = await Promise.all([
      q(`SELECT count(*) FILTER (WHERE ${PAID})::int AS orders,
                COALESCE(sum(o."priceWaveCoin") FILTER (WHERE ${KEPT}), 0)::int AS gmv,
                count(*) FILTER (WHERE o."status" = 'completed')::int AS "completedOrders",
                COALESCE(sum(o."priceWaveCoin") FILTER (WHERE o."status" = 'completed'), 0)::int AS "completedValue",
                count(*) FILTER (WHERE o."status" IN ('cancelled', 'refunded'))::int AS "refundedOrders",
                COALESCE(sum(o."priceWaveCoin") FILTER (WHERE o."status" IN ('cancelled', 'refunded')), 0)::int AS "refundedValue"
         FROM "orders" o WHERE o."createdAt" >= $1 AND o."createdAt" < $2`),
      // Fees are earned when an order completes, so they follow completedAt; escrow is "right now".
      q(`SELECT COALESCE(sum(o."platformFeeWaveCoin") FILTER (WHERE o."status" = 'completed' AND o."completedAt" >= $1 AND o."completedAt" < $2), 0)::int AS fees,
                COALESCE(sum(o."priceWaveCoin") FILTER (WHERE ${HELD}), 0)::int AS "inEscrow"
         FROM "orders" o`),
      q(`SELECT COALESCE(g."slug", 'none') AS key, COALESCE(g."name", '') AS label,
                count(*)::int AS orders, COALESCE(sum(o."priceWaveCoin") FILTER (WHERE ${KEPT}), 0)::int AS gmv,
                COALESCE(sum(o."platformFeeWaveCoin") FILTER (WHERE o."status" = 'completed'), 0)::int AS "platformFees"
         FROM "orders" o JOIN "listings" l ON l."id" = o."listingId" LEFT JOIN "games" g ON g."id" = l."gameId"
         WHERE ${PAID} AND o."createdAt" >= $1 AND o."createdAt" < $2
         GROUP BY g."slug", g."name" ORDER BY gmv DESC, orders DESC`),
      q(`SELECT o."listingType" AS key, o."listingType" AS label, count(*)::int AS orders,
                COALESCE(sum(o."priceWaveCoin") FILTER (WHERE ${KEPT}), 0)::int AS gmv,
                COALESCE(sum(o."platformFeeWaveCoin") FILTER (WHERE o."status" = 'completed'), 0)::int AS "platformFees"
         FROM "orders" o WHERE ${PAID} AND o."createdAt" >= $1 AND o."createdAt" < $2
         GROUP BY o."listingType" ORDER BY gmv DESC`),
      q(`SELECT c."slug" AS key, c."name" AS label, count(*)::int AS orders,
                COALESCE(sum(o."priceWaveCoin") FILTER (WHERE ${KEPT}), 0)::int AS gmv,
                COALESCE(sum(o."platformFeeWaveCoin") FILTER (WHERE o."status" = 'completed'), 0)::int AS "platformFees"
         FROM "orders" o JOIN "listings" l ON l."id" = o."listingId" JOIN "categories" c ON c."id" = l."categoryId"
         WHERE ${PAID} AND o."createdAt" >= $1 AND o."createdAt" < $2
         GROUP BY c."slug", c."name" ORDER BY gmv DESC`),
      q(`SELECT l."id" AS "listingId", l."title", l."type", g."name" AS game, u."username" AS seller,
                count(*)::int AS orders, COALESCE(sum(o."priceWaveCoin") FILTER (WHERE ${KEPT}), 0)::int AS gmv
         FROM "orders" o JOIN "listings" l ON l."id" = o."listingId" JOIN "users" u ON u."id" = l."sellerId"
         LEFT JOIN "games" g ON g."id" = l."gameId"
         WHERE ${PAID} AND o."createdAt" >= $1 AND o."createdAt" < $2
         GROUP BY l."id", g."name", u."username" ORDER BY gmv DESC, orders DESC LIMIT 10`),
      q(`SELECT u."username", count(*)::int AS orders, COALESCE(sum(o."priceWaveCoin") FILTER (WHERE ${KEPT}), 0)::int AS gmv,
                COALESCE(sum(o."platformFeeWaveCoin") FILTER (WHERE o."status" = 'completed'), 0)::int AS "platformFees"
         FROM "orders" o JOIN "users" u ON u."id" = o."sellerId"
         WHERE ${PAID} AND o."createdAt" >= $1 AND o."createdAt" < $2
         GROUP BY u."username" ORDER BY gmv DESC, orders DESC LIMIT 10`),
      q(`SELECT count(*)::int AS sessions,
                count(*) FILTER (WHERE s."status" = 'completed')::int AS completed,
                count(*) FILTER (WHERE s."status" = 'cancelled')::int AS cancelled,
                COALESCE(sum(s."priceWaveCoin") FILTER (WHERE s."status" <> 'cancelled'), 0)::int AS value,
                COALESCE(sum(s."platformFeeWaveCoin") FILTER (WHERE s."status" = 'completed'), 0)::int AS "platformFees"
         FROM "coaching_sessions" s WHERE s."createdAt" >= $1 AND s."createdAt" < $2`),
      q(`SELECT count(*) FILTER (WHERE us."status" IN ('active', 'past_due'))::int AS "activeNow",
                count(*) FILTER (WHERE us."status" IN ('active', 'past_due') AND us."grantedByAdminId" IS NOT NULL)::int AS "grantedNow",
                count(*) FILTER (WHERE us."createdAt" >= $1 AND us."createdAt" < $2)::int AS "newInRange",
                count(*) FILTER (WHERE us."status" IN ('cancelled', 'expired') AND us."updatedAt" >= $1 AND us."updatedAt" < $2)::int AS "cancelledInRange",
                (SELECT COALESCE(sum(a."amountGel"), 0)::int FROM "subscription_charge_attempts" a
                  WHERE a."status" = 'completed' AND a."createdAt" >= $1 AND a."createdAt" < $2) AS "revenueGel"
         FROM "user_subscriptions" us`),
      q(`SELECT COALESCE(round(sum(p."priceGel" * 30.0 / GREATEST(p."billingPeriodDays", 1))), 0)::int AS mrr
         FROM "user_subscriptions" us JOIN "subscription_plans" p ON p."id" = us."planId"
         WHERE us."status" IN ('active', 'past_due') AND us."grantedByAdminId" IS NULL`, []),
      q(`SELECT p."id" AS "planId", p."name", p."audience", p."priceGel",
                count(us."id") FILTER (WHERE us."status" IN ('active', 'past_due'))::int AS "activeNow",
                count(us."id") FILTER (WHERE us."createdAt" >= $1 AND us."createdAt" < $2)::int AS "newInRange",
                (SELECT COALESCE(sum(a."amountGel"), 0)::int FROM "subscription_charge_attempts" a
                  WHERE a."planId" = p."id" AND a."status" = 'completed' AND a."createdAt" >= $1 AND a."createdAt" < $2) AS "revenueGel"
         FROM "subscription_plans" p LEFT JOIN "user_subscriptions" us ON us."planId" = p."id"
         GROUP BY p."id" ORDER BY "activeNow" DESC, p."sortOrder" ASC`),
      q(`SELECT count(*)::int AS topups, COALESCE(sum(t."amountGel"), 0)::int AS "topupsGel"
         FROM "bog_topup_intents" t WHERE t."status" = 'completed' AND t."createdAt" >= $1 AND t."createdAt" < $2`),
      q(`SELECT count(*) FILTER (WHERE w."status" = 'completed' AND w."processedAt" >= $1 AND w."processedAt" < $2)::int AS "withdrawalsPaid",
                COALESCE(sum(w."amountWaveCoin") FILTER (WHERE w."status" = 'completed' AND w."processedAt" >= $1 AND w."processedAt" < $2), 0)::int AS "withdrawalsPaidValue",
                count(*) FILTER (WHERE w."status" IN ('pending', 'processing'))::int AS "withdrawalsPending",
                COALESCE(sum(w."amountWaveCoin") FILTER (WHERE w."status" IN ('pending', 'processing')), 0)::int AS "withdrawalsPendingValue"
         FROM "withdraw_requests" w`),
      q(`SELECT (SELECT count(*)::int FROM "users") AS total,
                (SELECT count(*)::int FROM "users" WHERE "createdAt" >= $1 AND "createdAt" < $2) AS "newInRange",
                (SELECT count(*)::int FROM "users" WHERE "createdAt" >= $1 AND "createdAt" < $2 AND "emailVerifiedAt" IS NOT NULL) AS "verifiedInRange",
                (SELECT count(DISTINCT o."sellerId")::int FROM "orders" o WHERE ${PAID} AND o."createdAt" >= $1 AND o."createdAt" < $2) AS "sellersWithSales",
                (SELECT count(DISTINCT o."buyerId")::int FROM "orders" o WHERE ${PAID} AND o."createdAt" >= $1 AND o."createdAt" < $2) AS buyers`),
      this.series(range, bucket),
    ]);

    const orders = int(sales.orders);
    const gmv = int(sales.gmv);
    const breakdown = (rows: Record<string, unknown>[]): AnalyticsBreakdownRow[] =>
      rows.map((r) => ({ key: String(r.key), label: String(r.label), orders: int(r.orders), gmv: int(r.gmv), platformFees: int(r.platformFees) }));

    return {
      from: from.toISOString().slice(0, 10),
      to: new Date(toExclusive.getTime() - DAY_MS).toISOString().slice(0, 10),
      bucket,
      sales: {
        orders,
        gmv,
        completedOrders: int(sales.completedOrders),
        completedValue: int(sales.completedValue),
        platformFees: int(escrow.fees),
        refundedOrders: int(sales.refundedOrders),
        refundedValue: int(sales.refundedValue),
        inEscrow: int(escrow.inEscrow),
        averageOrder: orders ? Math.round(gmv / orders) : 0,
      },
      byGame: breakdown(byGame),
      byType: breakdown(byType),
      byCategory: breakdown(byCategory),
      topListings: topListings.map((r) => ({
        listingId: String(r.listingId),
        title: String(r.title),
        type: r.type as ListingType,
        game: (r.game as string | null) ?? null,
        seller: String(r.seller),
        orders: int(r.orders),
        gmv: int(r.gmv),
      })),
      topSellers: topSellers.map((r) => ({ username: String(r.username), orders: int(r.orders), gmv: int(r.gmv), platformFees: int(r.platformFees) })),
      coaching: { sessions: int(coaching.sessions), completed: int(coaching.completed), cancelled: int(coaching.cancelled), value: int(coaching.value), platformFees: int(coaching.platformFees) },
      subscriptions: {
        activeNow: int(subs.activeNow),
        grantedNow: int(subs.grantedNow),
        newInRange: int(subs.newInRange),
        cancelledInRange: int(subs.cancelledInRange),
        revenueGel: int(subs.revenueGel),
        monthlyRecurringGel: int(mrr.mrr),
        byPlan: byPlan.map((r) => ({
          planId: String(r.planId),
          name: String(r.name),
          audience: String(r.audience),
          priceGel: int(r.priceGel),
          activeNow: int(r.activeNow),
          newInRange: int(r.newInRange),
          revenueGel: int(r.revenueGel),
        })),
      },
      money: {
        topups: int(topups.topups),
        topupsGel: int(topups.topupsGel),
        withdrawalsPaid: int(withdrawals.withdrawalsPaid),
        withdrawalsPaidValue: int(withdrawals.withdrawalsPaidValue),
        withdrawalsPending: int(withdrawals.withdrawalsPending),
        withdrawalsPendingValue: int(withdrawals.withdrawalsPendingValue),
      },
      users: {
        total: int(users.total),
        newInRange: int(users.newInRange),
        verifiedInRange: int(users.verifiedInRange),
        sellersWithSales: int(users.sellersWithSales),
        buyers: int(users.buyers),
      },
      series,
    };
  }

  // One row per day (≤120-day ranges) or per month, zero-filled, so the chart has no gaps.
  private async series(range: string[], bucket: 'day' | 'month') {
    const step = bucket === 'day' ? '1 day' : '1 month';
    const rows: Array<Record<string, unknown>> = await this.db.query(
      `WITH b AS (
         SELECT generate_series(date_trunc($3, $1::timestamptz AT TIME ZONE 'UTC'), date_trunc($3, ($2::timestamptz - interval '1 second') AT TIME ZONE 'UTC'), $4::interval) AS start
       ),
       o AS (
         SELECT date_trunc($3, o."createdAt" AT TIME ZONE 'UTC') AS k,
                COALESCE(sum(o."priceWaveCoin") FILTER (WHERE ${KEPT}), 0) AS gmv, count(*) AS orders
         FROM "orders" o WHERE ${PAID} AND o."createdAt" >= $1 AND o."createdAt" < $2 GROUP BY 1
       ),
       t AS (
         SELECT date_trunc($3, t."createdAt" AT TIME ZONE 'UTC') AS k, sum(t."amountGel") AS gel
         FROM "bog_topup_intents" t WHERE t."status" = 'completed' AND t."createdAt" >= $1 AND t."createdAt" < $2 GROUP BY 1
       ),
       a AS (
         SELECT date_trunc($3, a."createdAt" AT TIME ZONE 'UTC') AS k, sum(a."amountGel") AS gel
         FROM "subscription_charge_attempts" a WHERE a."status" = 'completed' AND a."createdAt" >= $1 AND a."createdAt" < $2 GROUP BY 1
       )
       SELECT to_char(b.start, 'YYYY-MM-DD') AS bucket, COALESCE(o.gmv, 0)::int AS gmv, COALESCE(o.orders, 0)::int AS orders,
              COALESCE(t.gel, 0)::int AS "topupsGel", COALESCE(a.gel, 0)::int AS "subscriptionsGel"
       FROM b LEFT JOIN o ON o.k = b.start LEFT JOIN t ON t.k = b.start LEFT JOIN a ON a.k = b.start
       ORDER BY b.start`,
      [...range, bucket, step],
    );
    return rows.map((r) => ({ bucket: String(r.bucket), gmv: int(r.gmv), orders: int(r.orders), topupsGel: int(r.topupsGel), subscriptionsGel: int(r.subscriptionsGel) }));
  }
}
