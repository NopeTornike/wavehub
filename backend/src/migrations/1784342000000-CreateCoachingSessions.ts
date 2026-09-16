import { MigrationInterface, QueryRunner } from 'typeorm';

// Booked, paid coaching sessions — see backend/src/coaching/CLAUDE.md for the scope (no
// availability calendar, no coach accept/decline step; a session is paid in full at request
// time, same as an order purchase). Also adds `sessionId` to wallet_ledger_entries alongside the
// existing `orderId` — mutually exclusive, never both set on one row — so a Session* ledger entry
// references the session it belongs to without reusing (and overloading the meaning of) `orderId`.
export class CreateCoachingSessions1784342000000 implements MigrationInterface {
  name = 'CreateCoachingSessions1784342000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "coaching_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "coachId" uuid NOT NULL,
        "buyerId" uuid NOT NULL,
        "scheduledAt" TIMESTAMPTZ NOT NULL,
        "durationMinutes" integer NOT NULL,
        "priceWaveCoin" integer NOT NULL,
        "platformFeePercentSnapshot" integer NOT NULL,
        "platformFeeWaveCoin" integer NOT NULL,
        "coachPayoutWaveCoin" integer NOT NULL,
        "buyerMessage" text,
        "status" character varying NOT NULL DEFAULT 'scheduled',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_coaching_sessions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_coaching_sessions_coachId" FOREIGN KEY ("coachId") REFERENCES "coaches"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_coaching_sessions_buyerId" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_coaching_sessions_coachId" ON "coaching_sessions" ("coachId")`);
    await queryRunner.query(`CREATE INDEX "IDX_coaching_sessions_buyerId" ON "coaching_sessions" ("buyerId")`);

    await queryRunner.query(`ALTER TABLE "wallet_ledger_entries" ADD COLUMN "sessionId" uuid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "wallet_ledger_entries" DROP COLUMN "sessionId"`);
    await queryRunner.query(`DROP TABLE "coaching_sessions"`);
  }
}
