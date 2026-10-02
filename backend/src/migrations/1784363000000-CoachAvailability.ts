import { MigrationInterface, QueryRunner } from 'typeorm';

// Coach working hours (coaching/CLAUDE.md, 2026-10-02): weekly ranges + days off + minimum notice,
// in Tbilisi time. NULL = not set yet (DEFAULT_COACH_AVAILABILITY — every day 10:00–24:00).
export class CoachAvailability1784363000000 implements MigrationInterface {
  name = 'CoachAvailability1784363000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "coaches" ADD "availability" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "coaches" DROP COLUMN "availability"`);
  }
}
