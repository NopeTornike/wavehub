import { MigrationInterface, QueryRunner } from 'typeorm';

// Direct (non-order) messaging between transacted users — see backend/src/chat/CLAUDE.md and
// LAUNCH_PLAN.md §4. Reuses the existing `conversations`/`messages` tables (ConversationType.Direct
// was already scaffolded, just unused until now) rather than a second, parallel table.
export class EnableDirectConversations1784345000000 implements MigrationInterface {
  name = 'EnableDirectConversations1784345000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // orderId is null for a Direct conversation. The existing UQ_conversations_orderId unique
    // constraint stays intact — Postgres allows any number of NULLs in a unique column/index.
    await queryRunner.query(`ALTER TABLE "conversations" ALTER COLUMN "orderId" DROP NOT NULL`);

    // At most one Direct conversation per unordered user pair, regardless of who started it or in
    // which column (buyerId/sellerId) each ended up — LEAST/GREATEST normalizes the pair before
    // comparing. Partial (WHERE type = 'direct') so it never applies to Order rows, which already
    // have their own uniqueness via orderId.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_direct_conversation_pair"
      ON "conversations" (LEAST("buyerId", "sellerId"), GREATEST("buyerId", "sellerId"))
      WHERE "type" = 'direct'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_direct_conversation_pair"`);
    await queryRunner.query(`ALTER TABLE "conversations" ALTER COLUMN "orderId" SET NOT NULL`);
  }
}
