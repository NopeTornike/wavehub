import { MigrationInterface, QueryRunner } from 'typeorm';

// "Helpful" likes on a product review and on the seller's reply to it (design 2026-10-04: 👍 count
// under each). One like per user per (review, target).
export class ReviewLikes1784380000000 implements MigrationInterface {
  name = 'ReviewLikes1784380000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "review_likes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "reviewId" uuid NOT NULL REFERENCES "reviews"("id") ON DELETE CASCADE,
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "target" varchar(6) NOT NULL CHECK ("target" IN ('review', 'reply')),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_review_likes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_review_likes" UNIQUE ("reviewId", "userId", "target")
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "review_likes"`);
  }
}
