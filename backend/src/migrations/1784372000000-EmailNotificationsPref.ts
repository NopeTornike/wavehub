import { MigrationInterface, QueryRunner } from 'typeorm';

// Users can switch off email copies of important notifications (notifications/CLAUDE.md, 2026-10-02).
export class EmailNotificationsPref1784372000000 implements MigrationInterface {
  name = 'EmailNotificationsPref1784372000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "emailNotifications" boolean NOT NULL DEFAULT true`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "emailNotifications"`);
  }
}
