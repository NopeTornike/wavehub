import { MigrationInterface, QueryRunner } from 'typeorm';

// Owner 2026-11-19: the Tournament Ranking (Top 10, players and teams separately) shows a nickname,
// a country flag and a W-L-D record; battle-royale results get per-player stats (kills, damage,
// assists, survival) shown under a team on the Match Results page.
export class TournamentRankingAndPlayerStats1784399000000 implements MigrationInterface {
  name = 'TournamentRankingAndPlayerStats1784399000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tournament_leaderboard_entries" ADD "nickname" character varying(40)`);
    await queryRunner.query(`ALTER TABLE "tournament_leaderboard_entries" ADD "country" character varying(2)`);
    await queryRunner.query(`ALTER TABLE "tournament_leaderboard_entries" ADD "losses" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "tournament_leaderboard_entries" ADD "draws" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "tournament_match_results" ADD "players" jsonb NOT NULL DEFAULT '[]'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tournament_match_results" DROP COLUMN "players"`);
    await queryRunner.query(`ALTER TABLE "tournament_leaderboard_entries" DROP COLUMN "draws"`);
    await queryRunner.query(`ALTER TABLE "tournament_leaderboard_entries" DROP COLUMN "losses"`);
    await queryRunner.query(`ALTER TABLE "tournament_leaderboard_entries" DROP COLUMN "country"`);
    await queryRunner.query(`ALTER TABLE "tournament_leaderboard_entries" DROP COLUMN "nickname"`);
  }
}
