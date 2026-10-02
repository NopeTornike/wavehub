import { MigrationInterface, QueryRunner } from 'typeorm';

// Digital-key orders are delivered the moment the key is claimed (orders/CLAUDE.md, 2026-10-02).
// Existing key orders that were stuck at paid/in_progress (nobody "starts" a key, so they could never
// be reviewed or paid out) move to delivered with a fresh 72-hour auto-complete window.
export class DeliverKeyOrders1784364000000 implements MigrationInterface {
  name = 'DeliverKeyOrders1784364000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "orders"
         SET "status" = 'delivered', "deliveredAt" = now(), "autoCompleteAt" = now() + interval '72 hours'
       WHERE "listingType" = 'digital_key' AND "status" IN ('paid', 'in_progress')
         AND NOT EXISTS (SELECT 1 FROM "disputes" d WHERE d."orderId" = "orders"."id")
    `);
  }

  public async down(): Promise<void> {
    // Not reversible: the old state was the bug.
  }
}
