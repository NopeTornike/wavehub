import { MigrationInterface, QueryRunner } from 'typeorm';

// Owner 2026-10-24: a banner can be a video (MP4/WebM) instead of a photo. It autoplays muted,
// shows no photo behind it, and the carousel moves on when it ends (marketing/CLAUDE.md).
export class BannerVideo1784386000000 implements MigrationInterface {
  name = 'BannerVideo1784386000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "banners" ADD "videoUrl" varchar(300) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "banners" DROP COLUMN "videoUrl"`);
  }
}
