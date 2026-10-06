import { MigrationInterface, QueryRunner } from 'typeorm';

// Client feedback 2026-10-04: #16 coaching has its own fee % (separate from the marketplace fee —
// starts at whatever the single fee was, so nothing changes until staff set it), and #2 staff pick
// which coaches the home page features.
export class CoachingFeeAndFeaturedCoach1784381000000 implements MigrationInterface {
  name = 'CoachingFeeAndFeaturedCoach1784381000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "platform_settings" ADD "coachingFeePercent" integer NOT NULL DEFAULT 10`);
    await queryRunner.query(`UPDATE "platform_settings" SET "coachingFeePercent" = "platformFeePercent"`);
    await queryRunner.query(`ALTER TABLE "platform_settings" ADD CONSTRAINT "CHK_coaching_fee" CHECK ("coachingFeePercent" BETWEEN 0 AND 100)`);
    await queryRunner.query(`ALTER TABLE "coaches" ADD "isFeatured" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "coaches" DROP COLUMN "isFeatured"`);
    await queryRunner.query(`ALTER TABLE "platform_settings" DROP CONSTRAINT "CHK_coaching_fee"`);
    await queryRunner.query(`ALTER TABLE "platform_settings" DROP COLUMN "coachingFeePercent"`);
  }
}
