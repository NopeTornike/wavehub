import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWithdrawRequests1784335000000 implements MigrationInterface {
  name = 'CreateWithdrawRequests1784335000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "withdraw_requests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "sellerId" uuid NOT NULL,
        "amountWaveCoin" integer NOT NULL,
        "method" character varying NOT NULL,
        "payoutDetails" jsonb NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "adminNote" text,
        "processedBy" uuid,
        "processedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_withdraw_requests_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_withdraw_requests_amount_positive" CHECK ("amountWaveCoin" > 0),
        CONSTRAINT "FK_withdraw_requests_seller" FOREIGN KEY ("sellerId") REFERENCES "users"("id"),
        CONSTRAINT "FK_withdraw_requests_processed_by" FOREIGN KEY ("processedBy") REFERENCES "users"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_withdraw_requests_seller" ON "withdraw_requests" ("sellerId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_withdraw_requests_seller"`);
    await queryRunner.query(`DROP TABLE "withdraw_requests"`);
  }
}
