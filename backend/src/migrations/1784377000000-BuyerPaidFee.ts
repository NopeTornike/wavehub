import { MigrationInterface, QueryRunner } from 'typeorm';

// Marketplace fee paid by the buyer on top of the price (owner decision 2026-10-03): the buyer pays
// price + fee, the seller receives the full price. `buyerTotalWaveCoin` is what was debited into
// escrow (and what a refund returns); `feePaidBy` records the rule each order was bought under.
// Existing orders were bought under the old rule (fee taken from the seller; buyer paid the price).
export class BuyerPaidFee1784377000000 implements MigrationInterface {
  name = 'BuyerPaidFee1784377000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD "buyerTotalWaveCoin" integer`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "feePaidBy" varchar(10) NOT NULL DEFAULT 'seller'`);
    await queryRunner.query(`UPDATE "orders" SET "buyerTotalWaveCoin" = "priceWaveCoin"`);
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "buyerTotalWaveCoin" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "feePaidBy" SET DEFAULT 'buyer'`);
    await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "CHK_orders_fee_paid_by" CHECK ("feePaidBy" IN ('buyer', 'seller'))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "CHK_orders_fee_paid_by"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "feePaidBy"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "buyerTotalWaveCoin"`);
  }
}
