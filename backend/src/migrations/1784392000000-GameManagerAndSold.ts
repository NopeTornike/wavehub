import { MigrationInterface, QueryRunner } from 'typeorm';

// Owner 2026-11-06: Game Manager staff scopes (users.staffScopes) and the staff-set SOLD mark on a
// listing (listings.soldAt — shown as an overlay, then the listing leaves the site 24h later).
export class GameManagerAndSold1784392000000 implements MigrationInterface {
  name = 'GameManagerAndSold1784392000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "staffScopes" jsonb`);
    await queryRunner.query(`ALTER TABLE "listings" ADD COLUMN "soldAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "listings" ADD COLUMN "soldRemovedAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`CREATE INDEX "IDX_listings_soldAt" ON "listings" ("soldAt") WHERE "soldAt" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_listings_soldAt"`);
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN "soldRemovedAt"`);
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN "soldAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "staffScopes"`);
  }
}
