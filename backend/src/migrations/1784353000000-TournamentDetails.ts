import { MigrationInterface, QueryRunner } from 'typeorm';

// The prototype's tournament page shows format, mode, region/server, platform, check-in/start
// times, registration deadline, entry fee, team size, minimum rank, bracket type, matches, who can
// join, communication and organizer, plus a Rules tab. Those become admin-editable: a flat `details`
// bag (validated like item attributes) and free-text `rules`. Anything left empty shows
// "To be announced", as on the prototype.
export class TournamentDetails1784353000000 implements MigrationInterface {
  name = 'TournamentDetails1784353000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tournaments" ADD COLUMN "details" jsonb NOT NULL DEFAULT '{}'`);
    await queryRunner.query(`ALTER TABLE "tournaments" ADD COLUMN "rules" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tournaments" DROP COLUMN "rules"`);
    await queryRunner.query(`ALTER TABLE "tournaments" DROP COLUMN "details"`);
  }
}
