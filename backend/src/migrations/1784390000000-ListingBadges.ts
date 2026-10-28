import { MigrationInterface, QueryRunner } from 'typeorm';

// Owner 2026-10-28: automatic listing badges (listings/CLAUDE.md "Badges"). HOT / TRENDING /
// MOST VIEWED / MOST POPULAR need views per time window, so views are counted per listing per hour
// from now on (the old lifetime `viewsCount` stays). PRICE DROP remembers the price before a cut of
// 10%+, JUST UPDATED the last real content edit, VERIFIED is a staff check of the account.
export class ListingBadges1784390000000 implements MigrationInterface {
  name = 'ListingBadges1784390000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "listing_view_hours" (
        "listingId" uuid NOT NULL REFERENCES "listings"("id") ON DELETE CASCADE,
        "hour" TIMESTAMPTZ NOT NULL,
        "views" integer NOT NULL DEFAULT 0,
        PRIMARY KEY ("listingId", "hour")
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_listing_view_hours_hour" ON "listing_view_hours" ("hour")`);
    await queryRunner.query(`ALTER TABLE "listings" ADD "previousPriceWaveCoin" integer NULL`);
    await queryRunner.query(`ALTER TABLE "listings" ADD "priceDroppedAt" TIMESTAMPTZ NULL`);
    await queryRunner.query(`ALTER TABLE "listings" ADD "contentUpdatedAt" TIMESTAMPTZ NULL`);
    await queryRunner.query(`ALTER TABLE "listings" ADD "verifiedAt" TIMESTAMPTZ NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN "verifiedAt"`);
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN "contentUpdatedAt"`);
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN "priceDroppedAt"`);
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN "previousPriceWaveCoin"`);
    await queryRunner.query(`DROP TABLE "listing_view_hours"`);
  }
}
