import { MigrationInterface, QueryRunner } from 'typeorm';

// 1. `listing_favorites` — the prototype's ♡ / Favorites page (backend/src/listings/
//    listing-favorite.entity.ts). Composite PK = one row per (user, listing).
// 2. Item-type categories. The original schema only seeded the spec's five SERVICE categories, so
//    item listings (accounts/skins) had to borrow one ("Account Setup Services"). The prototype's
//    marketplace sells exactly two kinds of item — Accounts and Skins — so those become real
//    `type = 'item'` categories, and existing item listings that were filed under a service
//    category move to "Accounts" (every item listing created so far is an account).
export class FavoritesAndItemCategories1784350000000 implements MigrationInterface {
  name = 'FavoritesAndItemCategories1784350000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "listing_favorites" (
        "userId" uuid NOT NULL,
        "listingId" uuid NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_listing_favorites" PRIMARY KEY ("userId", "listingId"),
        CONSTRAINT "FK_listing_favorites_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_listing_favorites_listing" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_listing_favorites_listing" ON "listing_favorites" ("listingId")`);

    await queryRunner.query(
      `INSERT INTO "categories" ("name", "slug", "type", "sortOrder", "isActive") VALUES
         ('Accounts', 'accounts', 'item', 10, true),
         ('Skins', 'skins', 'item', 11, true)
       ON CONFLICT ("slug") DO NOTHING`,
    );
    await queryRunner.query(`
      UPDATE "listings" l SET "categoryId" = (SELECT "id" FROM "categories" WHERE "slug" = 'accounts')
      WHERE l."type" = 'item'
        AND l."categoryId" IN (SELECT "id" FROM "categories" WHERE "type" = 'service')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Put item listings back under the category they used to borrow before removing the new ones.
    await queryRunner.query(`
      UPDATE "listings" SET "categoryId" = (SELECT "id" FROM "categories" WHERE "slug" = 'account-setup-services')
      WHERE "categoryId" IN (SELECT "id" FROM "categories" WHERE "slug" IN ('accounts', 'skins'))
    `);
    await queryRunner.query(`DELETE FROM "categories" WHERE "slug" IN ('accounts', 'skins')`);
    await queryRunner.query(`DROP TABLE "listing_favorites"`);
  }
}
