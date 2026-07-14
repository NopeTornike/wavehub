import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWalletLedger1784061957808 implements MigrationInterface {
  name = 'CreateWalletLedger1784061957808';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "wavecoinBalance" integer NOT NULL DEFAULT 0`,
    );

    await queryRunner.query(`
      CREATE TABLE "wallet_ledger_entries" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "orderId" uuid,
        "type" character varying NOT NULL,
        "amountWaveCoin" integer NOT NULL,
        "balanceAfter" integer NOT NULL,
        "status" character varying NOT NULL DEFAULT 'available',
        "availableAt" TIMESTAMPTZ,
        "reference" character varying,
        "createdBy" uuid,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_wallet_ledger_reference" UNIQUE ("reference"),
        CONSTRAINT "PK_wallet_ledger_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_wallet_ledger_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_wallet_ledger_user" ON "wallet_ledger_entries" ("userId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "bog_topup_intents" (
        "id" character varying NOT NULL,
        "userId" uuid NOT NULL,
        "amountGel" integer NOT NULL,
        "wavecoins" integer NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "bogOrderId" character varying,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bog_topup_intents_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_bog_topup_intents_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "bog_topup_intents"`);
    await queryRunner.query(`DROP INDEX "IDX_wallet_ledger_user"`);
    await queryRunner.query(`DROP TABLE "wallet_ledger_entries"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "wavecoinBalance"`);
  }
}
