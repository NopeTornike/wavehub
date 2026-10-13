import { MigrationInterface, QueryRunner } from 'typeorm';

// Marketing (marketing/CLAUDE.md, 2026-10-02): promo codes that add spendable WaveCoin credit
// (once per account, capped, optional window) and admin-managed homepage banners.
export class PromoCodesBanners1784374000000 implements MigrationInterface {
  name = 'PromoCodesBanners1784374000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "promo_codes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" varchar(30) NOT NULL,
        "amountWaveCoin" integer NOT NULL,
        "maxRedemptions" integer NOT NULL,
        "redeemedCount" integer NOT NULL DEFAULT 0,
        "startsAt" timestamptz,
        "expiresAt" timestamptz,
        "active" boolean NOT NULL DEFAULT true,
        "note" varchar(200),
        "createdBy" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_promo_codes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_promo_codes_code" UNIQUE ("code"),
        CONSTRAINT "CHK_promo_codes_code" CHECK ("code" ~ '^[A-Z0-9_-]{3,30}$'),
        CONSTRAINT "CHK_promo_codes_amount" CHECK ("amountWaveCoin" BETWEEN 1 AND 1000),
        CONSTRAINT "CHK_promo_codes_max" CHECK ("maxRedemptions" BETWEEN 1 AND 100000),
        CONSTRAINT "CHK_promo_codes_count" CHECK ("redeemedCount" BETWEEN 0 AND "maxRedemptions")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "promo_redemptions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "promoCodeId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "amountWaveCoin" integer NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_promo_redemptions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_promo_redemptions_code_user" UNIQUE ("promoCodeId", "userId"),
        CONSTRAINT "FK_promo_redemptions_code" FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_promo_redemptions_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_promo_redemptions_user" ON "promo_redemptions" ("userId")`);
    await queryRunner.query(`
      CREATE TABLE "banners" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "title" varchar(80) NOT NULL,
        "subtitle" varchar(200),
        "imageUrl" varchar(300),
        "linkUrl" varchar(300),
        "buttonLabel" varchar(30),
        "active" boolean NOT NULL DEFAULT false,
        "startsAt" timestamptz,
        "endsAt" timestamptz,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_banners" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "banners"`);
    await queryRunner.query(`DROP TABLE "promo_redemptions"`);
    await queryRunner.query(`DROP TABLE "promo_codes"`);
  }
}
