import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReviewsSchema1784331898935 implements MigrationInterface {
  name = 'CreateReviewsSchema1784331898935';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "listings" ADD COLUMN "ratingAvg" numeric(3,2)`);
    await queryRunner.query(`ALTER TABLE "listings" ADD COLUMN "ratingCount" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "sellerRatingAvg" numeric(3,2)`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "sellerRatingCount" integer NOT NULL DEFAULT 0`);

    await queryRunner.query(`
      CREATE TABLE "reviews" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "orderId" uuid NOT NULL,
        "listingId" uuid NOT NULL,
        "buyerId" uuid NOT NULL,
        "sellerId" uuid NOT NULL,
        "rating" smallint NOT NULL,
        "body" text,
        "tags" text[] NOT NULL DEFAULT '{}',
        "status" character varying NOT NULL DEFAULT 'published',
        "sellerReply" text,
        "sellerRepliedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_reviews_orderId" UNIQUE ("orderId"),
        CONSTRAINT "CHK_reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5),
        CONSTRAINT "PK_reviews_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reviews_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id"),
        CONSTRAINT "FK_reviews_listing" FOREIGN KEY ("listingId") REFERENCES "listings"("id"),
        CONSTRAINT "FK_reviews_buyer" FOREIGN KEY ("buyerId") REFERENCES "users"("id"),
        CONSTRAINT "FK_reviews_seller" FOREIGN KEY ("sellerId") REFERENCES "users"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_reviews_listing" ON "reviews" ("listingId")`);
    await queryRunner.query(`CREATE INDEX "IDX_reviews_seller" ON "reviews" ("sellerId")`);

    await queryRunner.query(`
      CREATE TABLE "review_reports" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "reviewId" uuid NOT NULL,
        "reportedBy" uuid NOT NULL,
        "reason" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_review_reports_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_review_reports_review" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_review_reports_reporter" FOREIGN KEY ("reportedBy") REFERENCES "users"("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "review_reports"`);
    await queryRunner.query(`DROP INDEX "IDX_reviews_seller"`);
    await queryRunner.query(`DROP INDEX "IDX_reviews_listing"`);
    await queryRunner.query(`DROP TABLE "reviews"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "sellerRatingCount"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "sellerRatingAvg"`);
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN "ratingCount"`);
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN "ratingAvg"`);
  }
}
