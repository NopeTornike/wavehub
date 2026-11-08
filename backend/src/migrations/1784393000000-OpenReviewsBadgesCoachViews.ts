import { MigrationInterface, QueryRunner } from 'typeorm';

// Owner 2026-11-08:
// - an email-verified user may write ONE review of a product without buying it: reviews.orderId
//   becomes nullable, and a partial unique index keeps one order-less review per user per listing
//   (an order-backed review stays one per order — UQ_reviews_orderId; NULLs don't collide there);
// - staff assign listing badges by hand (listings.manualBadges, merged with the automatic ones);
// - coach profiles show a view count like product cards (coaches.viewsCount).
export class OpenReviewsBadgesCoachViews1784393000000 implements MigrationInterface {
  name = 'OpenReviewsBadgesCoachViews1784393000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reviews" ALTER COLUMN "orderId" DROP NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_reviews_listing_buyer_open" ON "reviews" ("listingId", "buyerId") WHERE "orderId" IS NULL`);
    await queryRunner.query(`ALTER TABLE "listings" ADD "manualBadges" text[] NOT NULL DEFAULT '{}'`);
    await queryRunner.query(`ALTER TABLE "coaches" ADD "viewsCount" integer NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "coaches" DROP COLUMN "viewsCount"`);
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN "manualBadges"`);
    await queryRunner.query(`DROP INDEX "UQ_reviews_listing_buyer_open"`);
    await queryRunner.query(`DELETE FROM "reviews" WHERE "orderId" IS NULL`);
    await queryRunner.query(`ALTER TABLE "reviews" ALTER COLUMN "orderId" SET NOT NULL`);
  }
}
