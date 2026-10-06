import { MigrationInterface, QueryRunner } from 'typeorm';

// Owner 2026-10-07: every banner on the site is edited from the CMS (Admin → Banners), not only the
// homepage strip. Each banner now says where it shows; existing banners keep showing in the strip.
export class BannerPlacements1784383000000 implements MigrationInterface {
  name = 'BannerPlacements1784383000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "banners" ADD "placement" varchar(30) NOT NULL DEFAULT 'home_strip'`);
    await queryRunner.query(
      `ALTER TABLE "banners" ADD CONSTRAINT "CHK_banners_placement" CHECK ("placement" IN ('home_hero', 'home_strip', 'marketplace_top', 'services_top', 'steam_top', 'coaching_top', 'tournaments_top'))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_banners_placement" ON "banners" ("placement", "sortOrder")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_banners_placement"`);
    await queryRunner.query(`ALTER TABLE "banners" DROP CONSTRAINT "CHK_banners_placement"`);
    await queryRunner.query(`ALTER TABLE "banners" DROP COLUMN "placement"`);
  }
}
