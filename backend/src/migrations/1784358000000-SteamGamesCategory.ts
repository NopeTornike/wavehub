import { MigrationInterface, QueryRunner } from 'typeorm';

// Steam games get their own category (owner decision 2026-10-01): only the administration
// publishes them, always in this category, and they never appear in the marketplace grid.
// Existing digital-key listings are moved into it.
export class SteamGamesCategory1784358000000 implements MigrationInterface {
  name = 'SteamGamesCategory1784358000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "categories" ("name", "slug", "type", "sortOrder", "isActive")
       SELECT 'Steam თამაშები', 'steam-games', 'item', COALESCE(MAX("sortOrder"), 0) + 1, true FROM "categories"
       WHERE NOT EXISTS (SELECT 1 FROM "categories" WHERE "slug" = 'steam-games')`,
    );
    await queryRunner.query(
      `UPDATE "listings" SET "categoryId" = (SELECT "id" FROM "categories" WHERE "slug" = 'steam-games') WHERE "type" = 'digital_key'`,
    );
  }

  public async down(): Promise<void> {
    // Listings keep the category; the original per-listing categories aren't recoverable.
  }
}
