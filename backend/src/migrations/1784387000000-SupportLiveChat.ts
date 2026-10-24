import { MigrationInterface, QueryRunner } from 'typeorm';

// Owner 2026-10-24: "Contact support" opens a live chat with the support team (a ticket on the
// `chat` channel), operators "join" it, and both sides can attach files (screenshots, Word/PDF)
// like in disputes. support/CLAUDE.md.
export class SupportLiveChat1784387000000 implements MigrationInterface {
  name = 'SupportLiveChat1784387000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "support_tickets" ADD "channel" varchar(10) NOT NULL DEFAULT 'ticket'`);
    await queryRunner.query(`ALTER TABLE "support_tickets" ADD CONSTRAINT "CHK_support_tickets_channel" CHECK ("channel" IN ('ticket', 'chat'))`);
    await queryRunner.query(`ALTER TABLE "support_tickets" ADD "operatorId" uuid NULL REFERENCES "users"("id") ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE "support_tickets" ADD "operatorJoinedAt" TIMESTAMPTZ NULL`);
    await queryRunner.query(`CREATE INDEX "IDX_support_tickets_requester_channel" ON "support_tickets" ("requesterId", "channel")`);
    await queryRunner.query(`ALTER TABLE "support_ticket_messages" ADD "fileUrl" varchar(300) NULL`);
    await queryRunner.query(`ALTER TABLE "support_ticket_messages" ADD "fileType" varchar(100) NULL`);
    await queryRunner.query(`ALTER TABLE "support_ticket_messages" ADD "fileName" varchar(200) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "support_ticket_messages" DROP COLUMN "fileName"`);
    await queryRunner.query(`ALTER TABLE "support_ticket_messages" DROP COLUMN "fileType"`);
    await queryRunner.query(`ALTER TABLE "support_ticket_messages" DROP COLUMN "fileUrl"`);
    await queryRunner.query(`DROP INDEX "IDX_support_tickets_requester_channel"`);
    await queryRunner.query(`ALTER TABLE "support_tickets" DROP COLUMN "operatorJoinedAt"`);
    await queryRunner.query(`ALTER TABLE "support_tickets" DROP COLUMN "operatorId"`);
    await queryRunner.query(`ALTER TABLE "support_tickets" DROP CONSTRAINT "CHK_support_tickets_channel"`);
    await queryRunner.query(`ALTER TABLE "support_tickets" DROP COLUMN "channel"`);
  }
}
