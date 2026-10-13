import { MigrationInterface, QueryRunner } from 'typeorm';

// BOG subscription + membership/visibility plans (LAUNCH_PLAN.md §3, backend/src/subscriptions/
// CLAUDE.md). No seed data — a fabricated plan would violate root CLAUDE.md rule #6, and unlike
// games/categories (a fixed taxonomy) plan pricing/perks are a real product decision an admin
// makes through the real admin UI, not something to hardcode here.
export class CreateSubscriptions1784347000000 implements MigrationInterface {
  name = 'CreateSubscriptions1784347000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "subscription_plans" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "audience" character varying NOT NULL,
        "tier" character varying NOT NULL,
        "name" character varying NOT NULL,
        "description" text NOT NULL,
        "priceGel" integer NOT NULL,
        "billingPeriodDays" integer NOT NULL DEFAULT 30,
        "perks" jsonb NOT NULL DEFAULT '{}',
        "sortOrder" integer NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscription_plans_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "user_subscriptions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "planId" uuid NOT NULL,
        "audience" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'active',
        "currentPeriodEnd" TIMESTAMPTZ NOT NULL,
        "cancelAtPeriodEnd" boolean NOT NULL DEFAULT false,
        "bogParentOrderId" character varying NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_subscriptions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_us_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_us_plan" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id")
      )
    `);

    // At most one ACTIVE-OR-PAST_DUE subscription per user per audience — a user can't have two
    // simultaneous Buyer Membership subscriptions (or two Seller/Coach Visibility ones), but a
    // cancelled/expired row never blocks a fresh subscribe. `audience` is snapshotted onto
    // UserSubscription specifically so this index doesn't need a join to subscription_plans.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_user_subscriptions_active_per_audience"
      ON "user_subscriptions" ("userId", "audience")
      WHERE "status" IN ('active', 'past_due')
    `);

    await queryRunner.query(`
      CREATE TABLE "subscription_charge_attempts" (
        "id" character varying NOT NULL,
        "kind" character varying NOT NULL,
        "userId" uuid NOT NULL,
        "planId" uuid,
        "subscriptionId" uuid,
        "amountGel" integer NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "bogOrderId" character varying,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscription_charge_attempts_id" PRIMARY KEY ("id")
      )
    `);
    // Backs the cron sweep's "is there already a recent pending attempt for this subscription"
    // check (avoids re-firing a recharge every hour while the callback is still in flight).
    await queryRunner.query(
      `CREATE INDEX "IDX_sca_subscription" ON "subscription_charge_attempts" ("subscriptionId", "status", "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_sca_subscription"`);
    await queryRunner.query(`DROP TABLE "subscription_charge_attempts"`);
    await queryRunner.query(`DROP INDEX "UQ_user_subscriptions_active_per_audience"`);
    await queryRunner.query(`DROP TABLE "user_subscriptions"`);
    await queryRunner.query(`DROP TABLE "subscription_plans"`);
  }
}
