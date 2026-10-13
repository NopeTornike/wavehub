import { MigrationInterface, QueryRunner } from 'typeorm';

// Admin-managed game catalogue: staff can add games and upload their artwork. Until now the 14
// seeded games' art was bundled in the frontend by slug (frontend/lib/games.ts), so a new game
// had none. `coverUrl` = marketplace/listing cover, `tileUrl` = home game-grid tile (iconUrl exists).
export class GameArtwork1784357000000 implements MigrationInterface {
  name = 'GameArtwork1784357000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "games" ADD "coverUrl" character varying(500)`);
    await queryRunner.query(`ALTER TABLE "games" ADD "tileUrl" character varying(500)`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_games_name_lower" ON "games" (lower("name"))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_games_name_lower"`);
    await queryRunner.query(`ALTER TABLE "games" DROP COLUMN "tileUrl"`);
    await queryRunner.query(`ALTER TABLE "games" DROP COLUMN "coverUrl"`);
  }
}
