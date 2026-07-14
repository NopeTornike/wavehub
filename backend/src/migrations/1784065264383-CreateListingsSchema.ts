import { MigrationInterface, QueryRunner } from 'typeorm';

// Seeds the fixed taxonomy from the source spec (5 service categories, 5 games) as part of the same
// migration that creates the tables — see backend/src/listings/CLAUDE.md for why this is seeded
// here rather than via a separate seed script.
const CATEGORIES: Array<{ name: string; slug: string; sortOrder: number }> = [
  { name: 'Rank Push', slug: 'rank-push', sortOrder: 0 },
  { name: 'Coaching', slug: 'coaching', sortOrder: 1 },
  { name: 'Duo Play/Squad', slug: 'duo-play-squad', sortOrder: 2 },
  { name: 'Custom Gaming Services', slug: 'custom-gaming-services', sortOrder: 3 },
  { name: 'Account Setup Services', slug: 'account-setup-services', sortOrder: 4 },
];

const GAMES: Array<{ name: string; slug: string; sortOrder: number }> = [
  { name: 'PUBG Mobile', slug: 'pubg-mobile', sortOrder: 0 },
  { name: 'Call of Duty Mobile', slug: 'cod-mobile', sortOrder: 1 },
  { name: 'Free Fire', slug: 'free-fire', sortOrder: 2 },
  { name: 'Mobile Legends', slug: 'mobile-legends', sortOrder: 3 },
  { name: 'Roblox', slug: 'roblox', sortOrder: 4 },
];

export class CreateListingsSchema1784065264383 implements MigrationInterface {
  name = 'CreateListingsSchema1784065264383';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "slug" character varying NOT NULL,
        "type" character varying NOT NULL DEFAULT 'service',
        "sortOrder" integer NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        CONSTRAINT "UQ_categories_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_categories_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "games" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "slug" character varying NOT NULL,
        "iconUrl" character varying,
        "isActive" boolean NOT NULL DEFAULT true,
        "sortOrder" integer NOT NULL DEFAULT 0,
        CONSTRAINT "UQ_games_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_games_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "listings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "sellerId" uuid NOT NULL,
        "categoryId" uuid NOT NULL,
        "gameId" uuid,
        "type" character varying NOT NULL,
        "title" character varying NOT NULL,
        "description" text NOT NULL,
        "status" character varying NOT NULL DEFAULT 'draft',
        "rejectionReason" text,
        "viewsCount" integer NOT NULL DEFAULT 0,
        "ordersCount" integer NOT NULL DEFAULT 0,
        "isFeatured" boolean NOT NULL DEFAULT false,
        "priceWaveCoin" integer,
        "stockQuantity" integer,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_listings_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_listings_seller" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_listings_category" FOREIGN KEY ("categoryId") REFERENCES "categories"("id"),
        CONSTRAINT "FK_listings_game" FOREIGN KEY ("gameId") REFERENCES "games"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_listings_seller" ON "listings" ("sellerId")`);
    await queryRunner.query(`CREATE INDEX "IDX_listings_status" ON "listings" ("status")`);

    await queryRunner.query(`
      CREATE TABLE "listing_images" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "listingId" uuid NOT NULL,
        "url" character varying NOT NULL,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "moderationStatus" character varying NOT NULL DEFAULT 'approved',
        CONSTRAINT "PK_listing_images_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_listing_images_listing" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "service_details" (
        "listingId" uuid NOT NULL,
        "requirementsSchema" jsonb NOT NULL DEFAULT '[]',
        "faq" jsonb NOT NULL DEFAULT '[]',
        CONSTRAINT "PK_service_details_listingId" PRIMARY KEY ("listingId"),
        CONSTRAINT "FK_service_details_listing" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "item_details" (
        "listingId" uuid NOT NULL,
        "attributes" jsonb NOT NULL DEFAULT '{}',
        "isUnique" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_item_details_listingId" PRIMARY KEY ("listingId"),
        CONSTRAINT "FK_item_details_listing" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "packages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "listingId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "priceWaveCoin" integer NOT NULL,
        "deliveryTimeDays" integer NOT NULL,
        "features" text[] NOT NULL DEFAULT '{}',
        "revisionsIncluded" integer NOT NULL DEFAULT 0,
        "sortOrder" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_packages_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_packages_listing" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE
      )
    `);

    for (const category of CATEGORIES) {
      await queryRunner.query(
        `INSERT INTO "categories" ("name", "slug", "sortOrder") VALUES ($1, $2, $3)`,
        [category.name, category.slug, category.sortOrder],
      );
    }
    for (const game of GAMES) {
      await queryRunner.query(`INSERT INTO "games" ("name", "slug", "sortOrder") VALUES ($1, $2, $3)`, [
        game.name,
        game.slug,
        game.sortOrder,
      ]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "packages"`);
    await queryRunner.query(`DROP TABLE "item_details"`);
    await queryRunner.query(`DROP TABLE "service_details"`);
    await queryRunner.query(`DROP TABLE "listing_images"`);
    await queryRunner.query(`DROP INDEX "IDX_listings_status"`);
    await queryRunner.query(`DROP INDEX "IDX_listings_seller"`);
    await queryRunner.query(`DROP TABLE "listings"`);
    await queryRunner.query(`DROP TABLE "games"`);
    await queryRunner.query(`DROP TABLE "categories"`);
  }
}
