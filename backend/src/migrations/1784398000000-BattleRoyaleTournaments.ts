import { MigrationInterface, QueryRunner } from 'typeorm';

// Battle-royale tournaments (owner 2026-11-14, Gio; docs/design-mockups/round-7): a format per
// tournament (versus = CS2-style A vs B; battle_royale = every team of a group in one match), the
// number of teams leaving each group / the semifinals, a group per team, and per-team match results
// (placement, kills, points). Existing PUBG Mobile / Free Fire / Fortnite tournaments become battle royale.
export class BattleRoyaleTournaments1784398000000 implements MigrationInterface {
  name = 'BattleRoyaleTournaments1784398000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "tournaments" ADD "format" varchar(20) NOT NULL DEFAULT 'versus'`);
    await q.query(`ALTER TABLE "tournaments" ADD "groupAdvance" integer NOT NULL DEFAULT 2`);
    await q.query(`ALTER TABLE "tournaments" ADD "semifinalAdvance" integer NOT NULL DEFAULT 4`);
    await q.query(
      `UPDATE "tournaments" t SET "format" = 'battle_royale' FROM "games" g WHERE g."id" = t."gameId" AND g."slug" IN ('pubg-mobile', 'free-fire', 'fortnite')`,
    );
    await q.query(`ALTER TABLE "tournament_teams" ADD "groupName" varchar(10)`);
    await q.query(`CREATE TABLE "tournament_match_results" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      "matchId" uuid NOT NULL REFERENCES "tournament_matches"("id") ON DELETE CASCADE,
      "teamId" uuid NOT NULL REFERENCES "tournament_teams"("id") ON DELETE CASCADE,
      "placement" integer,
      "kills" integer NOT NULL DEFAULT 0,
      "points" integer NOT NULL DEFAULT 0,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_tournament_match_results_match_team" UNIQUE ("matchId", "teamId")
    )`);
    await q.query(`CREATE INDEX "IDX_tournament_match_results_team" ON "tournament_match_results" ("teamId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "tournament_match_results"`);
    await q.query(`ALTER TABLE "tournament_teams" DROP COLUMN "groupName"`);
    await q.query(`ALTER TABLE "tournaments" DROP COLUMN "semifinalAdvance"`);
    await q.query(`ALTER TABLE "tournaments" DROP COLUMN "groupAdvance"`);
    await q.query(`ALTER TABLE "tournaments" DROP COLUMN "format"`);
  }
}
