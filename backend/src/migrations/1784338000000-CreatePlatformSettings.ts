import { MigrationInterface, QueryRunner } from 'typeorm';

// Singleton settings table, seeded with exactly one row at a fixed well-known id — see
// backend/src/settings/platform-settings.entity.ts's PLATFORM_SETTINGS_SINGLETON_ID. Defaults
// match the hardcoded constants this table replaces: DEFAULT_PLATFORM_FEE_PERCENT (10) from
// backend/src/orders/orders.service.ts, MIN_WITHDRAWAL_WAVECOIN (20) from
// backend/src/withdrawals/withdrawals.service.ts.
const SINGLETON_ID = '00000000-0000-0000-0000-000000000001';

export class CreatePlatformSettings1784338000000 implements MigrationInterface {
  name = 'CreatePlatformSettings1784338000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "platform_settings" (
        "id" uuid NOT NULL,
        "platformFeePercent" integer NOT NULL DEFAULT 10,
        "minWithdrawalWaveCoin" integer NOT NULL DEFAULT 20,
        "maintenanceMode" boolean NOT NULL DEFAULT false,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_settings_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `INSERT INTO "platform_settings" ("id", "platformFeePercent", "minWithdrawalWaveCoin", "maintenanceMode")
       VALUES ($1, 10, 20, false)`,
      [SINGLETON_ID],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "platform_settings"`);
  }
}
