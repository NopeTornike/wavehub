import { MigrationInterface, QueryRunner } from 'typeorm';

// Trust & Safety (trust/CLAUDE.md, 2026-10-02): user reports, staff notes/warnings, hashed login
// history for multi-account detection, and a watchlist flag on users.
export class TrustSafety1784375000000 implements MigrationInterface {
  name = 'TrustSafety1784375000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "flagged" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`
      CREATE TABLE "user_reports" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "reporterId" uuid NOT NULL,
        "targetType" varchar(20) NOT NULL,
        "targetId" uuid NOT NULL,
        "targetUserId" uuid,
        "reason" varchar(20) NOT NULL,
        "details" varchar(1000),
        "evidence" varchar(2000),
        "status" varchar(20) NOT NULL DEFAULT 'open',
        "staffNote" varchar(1000),
        "handledBy" uuid,
        "handledAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_reports" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_user_reports_target" CHECK ("targetType" IN ('user','listing','coach','review','message')),
        CONSTRAINT "CHK_user_reports_reason" CHECK ("reason" IN ('spam','harassment','fraud','scam_listing','fake_account','offensive','other')),
        CONSTRAINT "CHK_user_reports_status" CHECK ("status" IN ('open','reviewing','actioned','dismissed')),
        CONSTRAINT "FK_user_reports_reporter" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_user_reports_status" ON "user_reports" ("status", "createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_user_reports_target_user" ON "user_reports" ("targetUserId")`);
    // One live report per reporter and target — re-reporting the same thing can't flood the queue.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_user_reports_live" ON "user_reports" ("reporterId", "targetType", "targetId") WHERE "status" IN ('open', 'reviewing')`,
    );
    await queryRunner.query(`
      CREATE TABLE "user_staff_notes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "authorId" uuid NOT NULL,
        "kind" varchar(10) NOT NULL,
        "body" varchar(1000) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_staff_notes" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_user_staff_notes_kind" CHECK ("kind" IN ('note','warning','flag','unflag')),
        CONSTRAINT "FK_user_staff_notes_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_staff_notes_author" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_user_staff_notes_user" ON "user_staff_notes" ("userId", "createdAt")`);
    await queryRunner.query(`
      CREATE TABLE "login_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "ipHash" varchar(64) NOT NULL,
        "uaHash" varchar(64) NOT NULL,
        "success" boolean NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_login_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_login_events_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_login_events_user" ON "login_events" ("userId", "createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_login_events_ip" ON "login_events" ("ipHash", "createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "login_events"`);
    await queryRunner.query(`DROP TABLE "user_staff_notes"`);
    await queryRunner.query(`DROP TABLE "user_reports"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "flagged"`);
  }
}
