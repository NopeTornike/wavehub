import { MigrationInterface, QueryRunner } from 'typeorm';

// Owner 2026-10-07: the auto-accept windows are set by staff (Admin → Settings) instead of being
// constants — delivered marketplace orders complete themselves after `orderAutoCompleteHours`
// (was AUTO_COMPLETE_HOURS = 24), coach-marked-done sessions after `sessionAutoConfirmHours` (was
// AUTO_CONFIRM_HOURS = 48). Sessions now store their own deadline like orders do, so changing
// the setting never moves a deadline a student was already shown.
export class AutoAcceptDurations1784384000000 implements MigrationInterface {
  name = 'AutoAcceptDurations1784384000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "platform_settings" ADD "orderAutoCompleteHours" integer NOT NULL DEFAULT 24`);
    await queryRunner.query(`ALTER TABLE "platform_settings" ADD "sessionAutoConfirmHours" integer NOT NULL DEFAULT 48`);
    await queryRunner.query(
      `ALTER TABLE "platform_settings" ADD CONSTRAINT "CHK_platform_settings_auto_hours" CHECK ("orderAutoCompleteHours" BETWEEN 1 AND 720 AND "sessionAutoConfirmHours" BETWEEN 1 AND 720)`,
    );
    await queryRunner.query(`ALTER TABLE "coaching_sessions" ADD "autoConfirmAt" TIMESTAMPTZ NULL`);
    await queryRunner.query(`UPDATE "coaching_sessions" SET "autoConfirmAt" = "coachCompletedAt" + interval '48 hours' WHERE "coachCompletedAt" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "coaching_sessions" DROP COLUMN "autoConfirmAt"`);
    await queryRunner.query(`ALTER TABLE "platform_settings" DROP CONSTRAINT "CHK_platform_settings_auto_hours"`);
    await queryRunner.query(`ALTER TABLE "platform_settings" DROP COLUMN "sessionAutoConfirmHours"`);
    await queryRunner.query(`ALTER TABLE "platform_settings" DROP COLUMN "orderAutoCompleteHours"`);
  }
}
