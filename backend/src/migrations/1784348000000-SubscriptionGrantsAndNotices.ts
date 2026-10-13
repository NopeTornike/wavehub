import { MigrationInterface, QueryRunner } from 'typeorm';

// Manual admin grants have no BOG parent order (no saved card), so `bogParentOrderId` becomes
// nullable — NULL means "never auto-renews, expires at currentPeriodEnd". `grantedByAdminId`
// records who granted it (audit_logs holds the reason). `expiryNoticeSentAt` de-dupes the
// "about to expire" notification so the hourly sweep sends it once per period.
export class SubscriptionGrantsAndNotices1784348000000 implements MigrationInterface {
  name = 'SubscriptionGrantsAndNotices1784348000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_subscriptions" ALTER COLUMN "bogParentOrderId" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "user_subscriptions" ADD COLUMN "grantedByAdminId" uuid`);
    await queryRunner.query(`ALTER TABLE "user_subscriptions" ADD COLUMN "expiryNoticeSentAt" TIMESTAMPTZ`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_subscriptions" DROP COLUMN "expiryNoticeSentAt"`);
    await queryRunner.query(`ALTER TABLE "user_subscriptions" DROP COLUMN "grantedByAdminId"`);
    // Manual grants can't satisfy NOT NULL again — drop them rather than fabricate a parent id.
    await queryRunner.query(`DELETE FROM "user_subscriptions" WHERE "bogParentOrderId" IS NULL`);
    await queryRunner.query(`ALTER TABLE "user_subscriptions" ALTER COLUMN "bogParentOrderId" SET NOT NULL`);
  }
}
