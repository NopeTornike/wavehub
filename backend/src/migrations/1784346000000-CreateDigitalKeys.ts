import { MigrationInterface, QueryRunner } from 'typeorm';

// Steam Keys (LAUNCH_PLAN.md §2d) — ListingType.DigitalKey is a plain app-level value (listings.type
// has no DB CHECK constraint, same as every other listing-type-like column in this schema), so this
// migration only needs to add the new table plus one attestation column on `listings`.
export class CreateDigitalKeys1784346000000 implements MigrationInterface {
  name = 'CreateDigitalKeys1784346000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Set once at listing-creation time for a DigitalKey listing (seller confirms they have the
    // legal right to resell these keys) — null for Service/Item listings. See
    // backend/src/listings/CLAUDE.md.
    await queryRunner.query(`ALTER TABLE "listings" ADD COLUMN "resaleRightsAttestedAt" TIMESTAMPTZ`);

    await queryRunner.query(`
      CREATE TABLE "listing_key_inventory" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "listingId" uuid NOT NULL,
        "keyValueEncrypted" text NOT NULL,
        "status" character varying NOT NULL DEFAULT 'available',
        "orderId" uuid,
        "soldAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_listing_key_inventory_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_listing_key_inventory_orderId" UNIQUE ("orderId"),
        CONSTRAINT "FK_lki_listing" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_lki_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id")
      )
    `);

    // Backs both OrdersService#purchase's `SELECT ... FOR UPDATE SKIP LOCKED` claim query and the
    // public browse/detail "how many keys are left" count — both filter on (listingId, status).
    await queryRunner.query(`CREATE INDEX "IDX_lki_listing_status" ON "listing_key_inventory" ("listingId", "status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_lki_listing_status"`);
    await queryRunner.query(`DROP TABLE "listing_key_inventory"`);
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN "resaleRightsAttestedAt"`);
  }
}
