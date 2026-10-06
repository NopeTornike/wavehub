import { MigrationInterface, QueryRunner } from 'typeorm';

// Stored badge grants (owner spec "WaveHubX Badge Assignment Logic", 2026-10-04): one row per user
// per badge (no duplicates), with when / by whom / from which source it was granted. Backfills the
// automatic badges existing users already earned.
export class UserBadges1784379000000 implements MigrationInterface {
  name = 'UserBadges1784379000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_badges" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "badgeKey" varchar(40) NOT NULL,
        "source" varchar(10) NOT NULL CHECK ("source" IN ('system', 'admin', 'coach')),
        "grantedById" uuid NULL REFERENCES "users"("id") ON DELETE SET NULL,
        "grantedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_badges" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_badges_user_key" UNIQUE ("userId", "badgeKey")
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_user_badges_granted_by" ON "user_badges" ("grantedById", "badgeKey")`);

    // Completed orders as buyer or seller → first-order / orders-100.
    await queryRunner.query(`
      WITH counts AS (
        SELECT u, count(*) AS n FROM (
          SELECT "buyerId" AS u FROM "orders" WHERE "status" = 'completed'
          UNION ALL SELECT "sellerId" FROM "orders" WHERE "status" = 'completed'
        ) x GROUP BY u
      )
      INSERT INTO "user_badges" ("userId", "badgeKey", "source")
        SELECT u, 'first-order', 'system' FROM counts WHERE n >= 1
        UNION ALL SELECT u, 'orders-100', 'system' FROM counts WHERE n >= 100
      ON CONFLICT DO NOTHING`);
    // Verified + active coaches → verified.
    await queryRunner.query(`
      INSERT INTO "user_badges" ("userId", "badgeKey", "source")
        SELECT "userId", 'verified', 'system' FROM "coaches" WHERE "verificationStatus" = 'verified' AND "status" = 'active'
      ON CONFLICT DO NOTHING`);
    // A live subscription → subscriber.
    await queryRunner.query(`
      INSERT INTO "user_badges" ("userId", "badgeKey", "source")
        SELECT DISTINCT "userId", 'subscriber', 'system' FROM "user_subscriptions" WHERE "status" IN ('active', 'past_due')
      ON CONFLICT DO NOTHING`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_badges"`);
  }
}
