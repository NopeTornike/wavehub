import { MigrationInterface, QueryRunner } from 'typeorm';

// Coaching session lifecycle v2 + the 6-step booking flow (coaching/CLAUDE.md, 2026-10-02):
// - packages can bundle several sessions (sessionsCount);
// - a booking groups its sessions (bookingGroupId) and carries the student's goal/challenges/Discord;
// - both sides confirm the start (reminders every 10 min, auto-cancel + refund when not confirmed),
//   the coach marks it done and the student confirms (or it auto-confirms) before the coach is paid.
export class CoachingLifecycle1784362000000 implements MigrationInterface {
  name = 'CoachingLifecycle1784362000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "coach_packages" ADD "sessionsCount" integer NOT NULL DEFAULT 1`);
    await queryRunner.query(`ALTER TABLE "coach_packages" ADD CONSTRAINT "CHK_coach_packages_sessions" CHECK ("sessionsCount" BETWEEN 1 AND 10)`);
    await queryRunner.query(`
      ALTER TABLE "coaching_sessions"
        ADD "bookingGroupId" uuid,
        ADD "goal" varchar(500),
        ADD "challenges" varchar(300),
        ADD "discord" varchar(40),
        ADD "coachStartConfirmedAt" timestamptz,
        ADD "buyerStartConfirmedAt" timestamptz,
        ADD "startedAt" timestamptz,
        ADD "coachCompletedAt" timestamptz,
        ADD "completedAt" timestamptz,
        ADD "lastReminderAt" timestamptz,
        ADD "remindersSent" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`CREATE INDEX "IDX_coaching_sessions_status_scheduled" ON "coaching_sessions" ("status", "scheduledAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_coaching_sessions_booking_group" ON "coaching_sessions" ("bookingGroupId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_coaching_sessions_booking_group"`);
    await queryRunner.query(`DROP INDEX "IDX_coaching_sessions_status_scheduled"`);
    await queryRunner.query(`
      ALTER TABLE "coaching_sessions"
        DROP COLUMN "bookingGroupId", DROP COLUMN "goal", DROP COLUMN "challenges", DROP COLUMN "discord",
        DROP COLUMN "coachStartConfirmedAt", DROP COLUMN "buyerStartConfirmedAt", DROP COLUMN "startedAt",
        DROP COLUMN "coachCompletedAt", DROP COLUMN "completedAt", DROP COLUMN "lastReminderAt", DROP COLUMN "remindersSent"
    `);
    await queryRunner.query(`ALTER TABLE "coach_packages" DROP CONSTRAINT "CHK_coach_packages_sessions"`);
    await queryRunner.query(`ALTER TABLE "coach_packages" DROP COLUMN "sessionsCount"`);
  }
}
