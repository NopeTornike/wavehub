import { MigrationInterface, QueryRunner } from 'typeorm';

// Super Admin-controlled Support permissions (settings/CLAUDE.md, 2026-10-01). Both off by default —
// SPECIFICATION.md §5.13.6 lists them as Support CANNOTs until a Super Admin turns them on.
export class SupportPermissions1784361000000 implements MigrationInterface {
  name = 'SupportPermissions1784361000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform_settings" ADD "supportPermissions" jsonb NOT NULL DEFAULT '{"walletAdjust": false, "walletAdjustMax": 100, "suspendUsers": false}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "platform_settings" DROP COLUMN "supportPermissions"`);
  }
}
