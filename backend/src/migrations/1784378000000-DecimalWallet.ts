import { MigrationInterface, QueryRunner } from 'typeorm';

// Exact (unrounded) buyer fees: 80 GEL at 6% = 4.80. The balance, every ledger amount/balanceAfter
// and an order's fee and buyer total become numeric(14,2). Widening integer → numeric is lossless;
// existing CHECK constraints (e.g. balance >= 0) keep applying.
export class DecimalWallet1784378000000 implements MigrationInterface {
  name = 'DecimalWallet1784378000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "wavecoinBalance" TYPE numeric(14,2)`);
    await queryRunner.query(`ALTER TABLE "wallet_ledger_entries" ALTER COLUMN "amountWaveCoin" TYPE numeric(14,2)`);
    await queryRunner.query(`ALTER TABLE "wallet_ledger_entries" ALTER COLUMN "balanceAfter" TYPE numeric(14,2)`);
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "platformFeeWaveCoin" TYPE numeric(14,2)`);
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "buyerTotalWaveCoin" TYPE numeric(14,2)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Lossy: rounds any tetri away. Only for rolling back before real fractional amounts exist.
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "buyerTotalWaveCoin" TYPE integer USING round("buyerTotalWaveCoin")`);
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "platformFeeWaveCoin" TYPE integer USING round("platformFeeWaveCoin")`);
    await queryRunner.query(`ALTER TABLE "wallet_ledger_entries" ALTER COLUMN "balanceAfter" TYPE integer USING round("balanceAfter")`);
    await queryRunner.query(`ALTER TABLE "wallet_ledger_entries" ALTER COLUMN "amountWaveCoin" TYPE integer USING round("amountWaveCoin")`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "wavecoinBalance" TYPE integer USING round("wavecoinBalance")`);
  }
}
