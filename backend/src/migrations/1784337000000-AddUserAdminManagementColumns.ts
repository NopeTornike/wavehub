import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds what backend/src/users/admin-users.controller.ts (suspend/restore/ban/unban) and the admin
// user list/dashboard need: a registration timestamp for sorting/"new registrations" stats, and a
// last-moderation-reason pair so a suspended/banned account's profile can show *why* without only
// relying on the separate audit_logs table.
export class AddUserAdminManagementColumns1784337000000 implements MigrationInterface {
  name = 'AddUserAdminManagementColumns1784337000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "moderationReason" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "moderationReason"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "createdAt"`);
  }
}
