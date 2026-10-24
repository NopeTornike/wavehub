import { MigrationInterface, QueryRunner } from 'typeorm';

// Owner 2026-10-24 (round 4, screenshot 02): a banner can carry a small label above its title
// ("WaveHubX coach interview") and feature one real coach (photo, name, game as a chip linking to
// the coach's profile). A deleted coach just drops off the banner.
export class BannerKickerCoach1784388000000 implements MigrationInterface {
  name = 'BannerKickerCoach1784388000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "banners" ADD "kicker" varchar(60) NULL`);
    await queryRunner.query(`ALTER TABLE "banners" ADD "coachId" uuid NULL REFERENCES "coaches"("id") ON DELETE SET NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "banners" DROP COLUMN "coachId"`);
    await queryRunner.query(`ALTER TABLE "banners" DROP COLUMN "kicker"`);
  }
}
