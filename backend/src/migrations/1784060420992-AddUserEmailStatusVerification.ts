import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds the fields Phase 1 (real auth sessions) needs on top of the Phase 0 baseline users table:
// email (a separate unique field from username — registration collects both), status (drives the
// pending_verification -> active gate), emailVerifiedAt. Existing rows get a placeholder email
// derived from username so the NOT NULL + UNIQUE constraint can be added safely; there are no real
// users in any deployed environment yet, so this is a formality, not a real backfill concern.
export class AddUserEmailStatusVerification1784060420992 implements MigrationInterface {
  name = 'AddUserEmailStatusVerification1784060420992';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "email" character varying`);
    await queryRunner.query(`UPDATE "users" SET "email" = "username" || '@placeholder.wavehub.local' WHERE "email" IS NULL`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_users_email" UNIQUE ("email")`);

    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "status" character varying NOT NULL DEFAULT 'pending_verification'`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "emailVerifiedAt" TIMESTAMPTZ`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "emailVerifiedAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "status"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_users_email"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email"`);
  }
}
