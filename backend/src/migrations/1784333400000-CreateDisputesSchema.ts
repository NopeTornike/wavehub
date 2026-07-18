import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDisputesSchema1784333400000 implements MigrationInterface {
  name = 'CreateDisputesSchema1784333400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "disputes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "orderId" uuid NOT NULL,
        "buyerId" uuid NOT NULL,
        "sellerId" uuid NOT NULL,
        "openedBy" uuid NOT NULL,
        "reason" text NOT NULL,
        "status" character varying NOT NULL DEFAULT 'open',
        "resolution" character varying,
        "resolutionNote" text,
        "resolvedBy" uuid,
        "resolvedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_disputes_orderId" UNIQUE ("orderId"),
        CONSTRAINT "PK_disputes_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_disputes_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id"),
        CONSTRAINT "FK_disputes_buyer" FOREIGN KEY ("buyerId") REFERENCES "users"("id"),
        CONSTRAINT "FK_disputes_seller" FOREIGN KEY ("sellerId") REFERENCES "users"("id"),
        CONSTRAINT "FK_disputes_opened_by" FOREIGN KEY ("openedBy") REFERENCES "users"("id"),
        CONSTRAINT "FK_disputes_resolved_by" FOREIGN KEY ("resolvedBy") REFERENCES "users"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "dispute_messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "disputeId" uuid NOT NULL,
        "senderId" uuid NOT NULL,
        "body" text NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_dispute_messages_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_dispute_messages_dispute" FOREIGN KEY ("disputeId") REFERENCES "disputes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_dispute_messages_sender" FOREIGN KEY ("senderId") REFERENCES "users"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_dispute_messages_dispute" ON "dispute_messages" ("disputeId")`);

    await queryRunner.query(`
      CREATE TABLE "dispute_evidence" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "disputeId" uuid NOT NULL,
        "uploadedBy" uuid NOT NULL,
        "fileUrl" character varying NOT NULL,
        "fileType" character varying NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_dispute_evidence_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_dispute_evidence_dispute" FOREIGN KEY ("disputeId") REFERENCES "disputes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_dispute_evidence_uploader" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_dispute_evidence_dispute" ON "dispute_evidence" ("disputeId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_dispute_evidence_dispute"`);
    await queryRunner.query(`DROP TABLE "dispute_evidence"`);
    await queryRunner.query(`DROP INDEX "IDX_dispute_messages_dispute"`);
    await queryRunner.query(`DROP TABLE "dispute_messages"`);
    await queryRunner.query(`DROP TABLE "disputes"`);
  }
}
