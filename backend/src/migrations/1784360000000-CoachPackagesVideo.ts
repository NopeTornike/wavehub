import { MigrationInterface, QueryRunner } from 'typeorm';

// Coaching packages + pre-booking questions + uploaded intro video (coaching/CLAUDE.md, 2026-10-01).
// A session snapshots the package name it was booked from (packageId is SET NULL if the coach later
// removes the package) and stores the buyer's answers to the coach's questions.
export class CoachPackagesVideo1784360000000 implements MigrationInterface {
  name = 'CoachPackagesVideo1784360000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "coaches" ADD "videoFileUrl" varchar(300)`);
    await queryRunner.query(`ALTER TABLE "coaches" ADD "bookingQuestions" jsonb NOT NULL DEFAULT '[]'`);
    await queryRunner.query(`
      CREATE TABLE "coach_packages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "coachId" uuid NOT NULL,
        "name" varchar(60) NOT NULL,
        "description" varchar(300),
        "durationMinutes" integer NOT NULL,
        "priceWaveCoin" integer NOT NULL,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_coach_packages" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_coach_packages_price" CHECK ("priceWaveCoin" BETWEEN 1 AND 100000),
        CONSTRAINT "CHK_coach_packages_duration" CHECK ("durationMinutes" BETWEEN 15 AND 480),
        CONSTRAINT "FK_coach_packages_coach" FOREIGN KEY ("coachId") REFERENCES "coaches"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_coach_packages_coach" ON "coach_packages" ("coachId")`);
    await queryRunner.query(`ALTER TABLE "coaching_sessions" ADD "packageId" uuid`);
    await queryRunner.query(`ALTER TABLE "coaching_sessions" ADD "packageName" varchar(60)`);
    await queryRunner.query(`ALTER TABLE "coaching_sessions" ADD "answers" jsonb`);
    await queryRunner.query(
      `ALTER TABLE "coaching_sessions" ADD CONSTRAINT "FK_coaching_sessions_package" FOREIGN KEY ("packageId") REFERENCES "coach_packages"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "coaching_sessions" DROP CONSTRAINT "FK_coaching_sessions_package"`);
    await queryRunner.query(`ALTER TABLE "coaching_sessions" DROP COLUMN "answers"`);
    await queryRunner.query(`ALTER TABLE "coaching_sessions" DROP COLUMN "packageName"`);
    await queryRunner.query(`ALTER TABLE "coaching_sessions" DROP COLUMN "packageId"`);
    await queryRunner.query(`DROP TABLE "coach_packages"`);
    await queryRunner.query(`ALTER TABLE "coaches" DROP COLUMN "bookingQuestions"`);
    await queryRunner.query(`ALTER TABLE "coaches" DROP COLUMN "videoFileUrl"`);
  }
}
