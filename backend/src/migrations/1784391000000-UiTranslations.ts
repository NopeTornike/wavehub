import { MigrationInterface, QueryRunner } from 'typeorm';

// Owner 2026-10-28: staff edit any UI text in both languages from Admin → Translations. One row per
// source string (the Georgian text the app renders); `en` replaces its English, `ka` replaces the
// Georgian shown. translations/CLAUDE.md.
export class UiTranslations1784391000000 implements MigrationInterface {
  name = 'UiTranslations1784391000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ui_translations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "key" text NOT NULL,
        "en" text NULL,
        "ka" text NULL,
        "updatedById" uuid NULL REFERENCES "users"("id") ON DELETE SET NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_ui_translations_key" UNIQUE ("key"),
        CONSTRAINT "CHK_ui_translations_value" CHECK ("en" IS NOT NULL OR "ka" IS NOT NULL)
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ui_translations"`);
  }
}
