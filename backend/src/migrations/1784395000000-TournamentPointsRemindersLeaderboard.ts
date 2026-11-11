import { MigrationInterface, QueryRunner } from 'typeorm';

// Owner 2026-11-10 (docs/design-mockups/round-6):
// - group points: each tournament sets points per win / loss and the group-exit threshold;
// - match notifications: reminder + result flags so every reminder / result goes out once;
// - a hand-entered tournament leaderboard (players by @username, teams by name + logo);
// - show/hide switches for the new public blocks (platform_settings.features).
export class TournamentPointsRemindersLeaderboard1784395000000 implements MigrationInterface {
  name = 'TournamentPointsRemindersLeaderboard1784395000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tournaments" ADD "pointsPerWin" integer NOT NULL DEFAULT 3`);
    await queryRunner.query(`ALTER TABLE "tournaments" ADD "pointsPerLoss" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "tournaments" ADD "qualifyPoints" integer`);
    await queryRunner.query(`ALTER TABLE "tournament_matches" ADD "remindedDayAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "tournament_matches" ADD "remindedHourAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "tournament_matches" ADD "resultNotifiedAt" TIMESTAMP WITH TIME ZONE`);
    // Results recorded before this release must not notify anyone now.
    await queryRunner.query(`UPDATE "tournament_matches" SET "resultNotifiedAt" = now() WHERE "status" = 'completed'`);
    await queryRunner.query(`CREATE INDEX "IDX_tournament_matches_scheduled" ON "tournament_matches" ("scheduledAt") WHERE "status" = 'scheduled'`);
    await queryRunner.query(
      `ALTER TABLE "platform_settings" ADD "features" jsonb NOT NULL DEFAULT '{"tournamentLeaderboard": true, "sellerLeaderboard": true, "rewardsHub": true}'`,
    );
    await queryRunner.query(`CREATE TABLE "tournament_leaderboard_entries" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "kind" character varying(10) NOT NULL,
      "gameId" uuid,
      "userId" uuid,
      "name" character varying(40) NOT NULL,
      "logoUrl" character varying,
      "wins" integer NOT NULL DEFAULT 0,
      "kills" integer NOT NULL DEFAULT 0,
      "points" integer NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_tournament_leaderboard_entries" PRIMARY KEY ("id"),
      CONSTRAINT "FK_tle_game" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE SET NULL,
      CONSTRAINT "FK_tle_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE INDEX "IDX_tle_kind_points" ON "tournament_leaderboard_entries" ("kind", "points" DESC)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tournament_leaderboard_entries"`);
    await queryRunner.query(`ALTER TABLE "platform_settings" DROP COLUMN "features"`);
    await queryRunner.query(`DROP INDEX "IDX_tournament_matches_scheduled"`);
    await queryRunner.query(`ALTER TABLE "tournament_matches" DROP COLUMN "resultNotifiedAt"`);
    await queryRunner.query(`ALTER TABLE "tournament_matches" DROP COLUMN "remindedHourAt"`);
    await queryRunner.query(`ALTER TABLE "tournament_matches" DROP COLUMN "remindedDayAt"`);
    await queryRunner.query(`ALTER TABLE "tournaments" DROP COLUMN "qualifyPoints"`);
    await queryRunner.query(`ALTER TABLE "tournaments" DROP COLUMN "pointsPerLoss"`);
    await queryRunner.query(`ALTER TABLE "tournaments" DROP COLUMN "pointsPerWin"`);
  }
}
