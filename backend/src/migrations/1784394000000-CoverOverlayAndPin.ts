import { MigrationInterface, QueryRunner } from 'typeorm';

// Owner 2026-11-09:
// - staff put a cover over a product like the SOLD banner — the "Tournament Gift" artwork or their
//   own image (listings.coverOverlay 'gift' | 'custom', coverOverlayUrl for the custom one) — and
//   while it's on nobody can buy the product;
// - staff pin products to the first places of the marketplace (listings.pinnedAt; earliest first).
export class CoverOverlayAndPin1784394000000 implements MigrationInterface {
  name = 'CoverOverlayAndPin1784394000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "listings" ADD "coverOverlay" character varying(16)`);
    await queryRunner.query(`ALTER TABLE "listings" ADD "coverOverlayUrl" character varying(500)`);
    await queryRunner.query(`ALTER TABLE "listings" ADD "pinnedAt" TIMESTAMP WITH TIME ZONE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN "pinnedAt"`);
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN "coverOverlayUrl"`);
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN "coverOverlay"`);
  }
}
