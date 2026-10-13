import { MigrationInterface, QueryRunner } from 'typeorm';

// Disputes for coaching sessions (coaching/CLAUDE.md "Session disputes", 2026-10-02): a thread
// (participants + staff, text and evidence files) and a Super Admin decision.
export class CoachingSessionDisputes1784373000000 implements MigrationInterface {
  name = 'CoachingSessionDisputes1784373000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "coaching_session_disputes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "sessionId" uuid NOT NULL,
        "openedBy" uuid NOT NULL,
        "reason" varchar(1000) NOT NULL,
        "status" varchar NOT NULL DEFAULT 'open',
        "resolution" varchar,
        "resolutionNote" varchar(1000),
        "resolvedBy" uuid,
        "resolvedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_coaching_session_disputes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_coaching_session_disputes_session" UNIQUE ("sessionId"),
        CONSTRAINT "CHK_coaching_session_disputes_status" CHECK ("status" IN ('open', 'resolved')),
        CONSTRAINT "CHK_coaching_session_disputes_resolution" CHECK ("resolution" IS NULL OR "resolution" IN ('refund_student', 'pay_coach')),
        CONSTRAINT "FK_coaching_session_disputes_session" FOREIGN KEY ("sessionId") REFERENCES "coaching_sessions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_coaching_session_disputes_opener" FOREIGN KEY ("openedBy") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_coaching_session_disputes_status" ON "coaching_session_disputes" ("status", "createdAt")`);
    await queryRunner.query(`
      CREATE TABLE "coaching_session_dispute_messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "disputeId" uuid NOT NULL,
        "senderId" uuid NOT NULL,
        "isStaff" boolean NOT NULL DEFAULT false,
        "body" varchar(2000),
        "fileUrl" varchar(300),
        "fileType" varchar(100),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_coaching_session_dispute_messages" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_coaching_session_dispute_messages_content" CHECK ("body" IS NOT NULL OR "fileUrl" IS NOT NULL),
        CONSTRAINT "FK_coaching_session_dispute_messages_dispute" FOREIGN KEY ("disputeId") REFERENCES "coaching_session_disputes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_coaching_session_dispute_messages_sender" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_coaching_session_dispute_messages_dispute" ON "coaching_session_dispute_messages" ("disputeId", "createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "coaching_session_dispute_messages"`);
    await queryRunner.query(`DROP TABLE "coaching_session_disputes"`);
  }
}
