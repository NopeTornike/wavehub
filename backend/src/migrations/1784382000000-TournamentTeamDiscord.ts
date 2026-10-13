import { MigrationInterface, QueryRunner } from 'typeorm';

// Client feedback #6 (2026-10-04): every tournament registration leaves a Discord contact (invite
// link or username) staff use to reach the team. Nullable — older registrations have none.
export class TournamentTeamDiscord1784382000000 implements MigrationInterface {
  name = 'TournamentTeamDiscord1784382000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tournament_teams" ADD "discord" varchar(120) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tournament_teams" DROP COLUMN "discord"`);
  }
}
