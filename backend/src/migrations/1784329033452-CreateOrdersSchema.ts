import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrdersSchema1784329033452 implements MigrationInterface {
  name = 'CreateOrdersSchema1784329033452';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Backs the human-facing "WH-000123" order numbers (OrdersService formats
    // nextval('order_number_seq') with a zero-padded WH- prefix) — a real Postgres sequence gives
    // gap-minimal, race-free sequential numbers, which a UUID or app-generated counter wouldn't.
    await queryRunner.query(`CREATE SEQUENCE "order_number_seq" START 1`);

    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "orderNumber" character varying NOT NULL,
        "buyerId" uuid NOT NULL,
        "sellerId" uuid NOT NULL,
        "listingId" uuid NOT NULL,
        "packageId" uuid,
        "listingType" character varying NOT NULL,
        "status" character varying NOT NULL,
        "requirementsAnswers" jsonb,
        "priceWaveCoin" integer NOT NULL,
        "platformFeePercentSnapshot" integer NOT NULL,
        "platformFeeWaveCoin" integer NOT NULL,
        "sellerPayoutWaveCoin" integer NOT NULL,
        "deliveryDueAt" TIMESTAMPTZ,
        "deliveredAt" TIMESTAMPTZ,
        "autoCompleteAt" TIMESTAMPTZ,
        "completedAt" TIMESTAMPTZ,
        "cancelledAt" TIMESTAMPTZ,
        "cancellationReason" text,
        "revisionReason" text,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_orders_orderNumber" UNIQUE ("orderNumber"),
        CONSTRAINT "PK_orders_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_orders_buyer" FOREIGN KEY ("buyerId") REFERENCES "users"("id"),
        CONSTRAINT "FK_orders_seller" FOREIGN KEY ("sellerId") REFERENCES "users"("id"),
        CONSTRAINT "FK_orders_listing" FOREIGN KEY ("listingId") REFERENCES "listings"("id"),
        CONSTRAINT "FK_orders_package" FOREIGN KEY ("packageId") REFERENCES "packages"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_orders_buyer" ON "orders" ("buyerId")`);
    await queryRunner.query(`CREATE INDEX "IDX_orders_seller" ON "orders" ("sellerId")`);
    await queryRunner.query(`CREATE INDEX "IDX_orders_status" ON "orders" ("status")`);

    // Add the real FK from wallet_ledger_entries.orderId now that `orders` exists — it was left
    // bare (no FK) when the wallet ledger was created ahead of Orders. See wallet/CLAUDE.md.
    await queryRunner.query(`
      ALTER TABLE "wallet_ledger_entries"
      ADD CONSTRAINT "FK_wallet_ledger_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id")
    `);

    await queryRunner.query(`
      CREATE TABLE "order_delivery_files" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "orderId" uuid NOT NULL,
        "uploadedBy" uuid NOT NULL,
        "fileUrl" character varying NOT NULL,
        "fileType" character varying NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_delivery_files_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_order_delivery_files_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_order_delivery_files_uploader" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "order_delivery_files"`);
    await queryRunner.query(`ALTER TABLE "wallet_ledger_entries" DROP CONSTRAINT "FK_wallet_ledger_order"`);
    await queryRunner.query(`DROP INDEX "IDX_orders_status"`);
    await queryRunner.query(`DROP INDEX "IDX_orders_seller"`);
    await queryRunner.query(`DROP INDEX "IDX_orders_buyer"`);
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP SEQUENCE "order_number_seq"`);
  }
}
