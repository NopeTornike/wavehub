import { MigrationInterface, QueryRunner } from 'typeorm';

// User Hub rewards (owner 2026-11-10, docs/design-mockups/round-6/02): staff-written tasks with XP,
// page-visit / check-in log (also the streak source), the XP ledger, weekly prizes and winners.
export class RewardsHub1784396000000 implements MigrationInterface {
  name = 'RewardsHub1784396000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "reward_tasks" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      "title" varchar(80) NOT NULL,
      "description" varchar(200),
      "trigger" varchar(32) NOT NULL,
      "target" integer NOT NULL DEFAULT 1,
      "xp" integer NOT NULL,
      "period" varchar(10) NOT NULL DEFAULT 'daily',
      "isActive" boolean NOT NULL DEFAULT true,
      "sortOrder" integer NOT NULL DEFAULT 0,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE TABLE "reward_visits" (
      "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "day" date NOT NULL,
      "page" varchar(24) NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("userId", "day", "page")
    )`);
    await q.query(`CREATE TABLE "reward_xp" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "key" varchar(80) NOT NULL,
      "taskId" uuid REFERENCES "reward_tasks"("id") ON DELETE SET NULL,
      "title" varchar(80) NOT NULL,
      "xp" integer NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_reward_xp_user_key" UNIQUE ("userId", "key")
    )`);
    await q.query(`CREATE INDEX "IDX_reward_xp_created" ON "reward_xp" ("createdAt")`);
    await q.query(`CREATE TABLE "reward_prizes" (
      "place" smallint NOT NULL PRIMARY KEY CHECK ("place" BETWEEN 1 AND 3),
      "title" varchar(80) NOT NULL,
      "description" varchar(300),
      "imageUrl" varchar,
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE TABLE "reward_wins" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      "weekStart" date NOT NULL,
      "place" smallint NOT NULL,
      "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "xp" integer NOT NULL,
      "prizeTitle" varchar(80) NOT NULL,
      "prizeDescription" varchar(300),
      "prizeImageUrl" varchar,
      "openedAt" timestamptz,
      "deliveredAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_reward_wins_week_place" UNIQUE ("weekStart", "place")
    )`);
    await q.query(`CREATE INDEX "IDX_reward_wins_user" ON "reward_wins" ("userId")`);
    await q.query(`ALTER TABLE "platform_settings" ADD "rewardStreakBonusXp" integer NOT NULL DEFAULT 200`);
    // A starter set staff can edit or switch off — every one is checked against real activity.
    await q.query(`INSERT INTO "reward_tasks" ("title", "trigger", "target", "xp", "period", "sortOrder") VALUES
      ('Log in to WaveHubX', 'login', 1, 50, 'daily', 1),
      ('Visit Marketplace', 'visit_marketplace', 1, 75, 'daily', 2),
      ('Check Tournaments', 'visit_tournaments', 1, 75, 'daily', 3),
      ('Follow 1 Seller or Coach', 'follow', 1, 100, 'daily', 4),
      ('First Purchase', 'purchase', 1, 500, 'once', 10),
      ('Join a Tournament', 'tournament_join', 1, 750, 'once', 11),
      ('10 Orders', 'purchase', 10, 1500, 'once', 12)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "platform_settings" DROP COLUMN "rewardStreakBonusXp"`);
    await q.query(`DROP TABLE "reward_wins"`);
    await q.query(`DROP TABLE "reward_prizes"`);
    await q.query(`DROP TABLE "reward_xp"`);
    await q.query(`DROP TABLE "reward_visits"`);
    await q.query(`DROP TABLE "reward_tasks"`);
  }
}
