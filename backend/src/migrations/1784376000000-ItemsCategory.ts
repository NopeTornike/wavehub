import { MigrationInterface, QueryRunner } from 'typeorm';

// "Items" next to Accounts and Skins in the marketplace (owner, 2026-10-03): in-game items,
// currency packs and the like, sold with the same item-listing flow.
export class ItemsCategory1784376000000 implements MigrationInterface {
  name = 'ItemsCategory1784376000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`INSERT INTO categories (name, slug, type, "sortOrder") VALUES ('Items', 'items', 'item', 11) ON CONFLICT (slug) DO NOTHING`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM categories WHERE slug = 'items' AND NOT EXISTS (SELECT 1 FROM listings l WHERE l."categoryId" = categories.id)`);
  }
}
