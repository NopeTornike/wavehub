import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChatSchema1784332500000 implements MigrationInterface {
  name = 'CreateChatSchema1784332500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "conversations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "type" character varying NOT NULL DEFAULT 'order',
        "orderId" uuid NOT NULL,
        "buyerId" uuid NOT NULL,
        "sellerId" uuid NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_conversations_orderId" UNIQUE ("orderId"),
        CONSTRAINT "PK_conversations_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_conversations_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id"),
        CONSTRAINT "FK_conversations_buyer" FOREIGN KEY ("buyerId") REFERENCES "users"("id"),
        CONSTRAINT "FK_conversations_seller" FOREIGN KEY ("sellerId") REFERENCES "users"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "conversationId" uuid NOT NULL,
        "senderId" uuid,
        "type" character varying NOT NULL DEFAULT 'text',
        "body" text NOT NULL,
        "status" character varying NOT NULL DEFAULT 'sent',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_messages_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_messages_conversation" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_messages_sender" FOREIGN KEY ("senderId") REFERENCES "users"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_messages_conversation" ON "messages" ("conversationId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_messages_conversation"`);
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP TABLE "conversations"`);
  }
}
