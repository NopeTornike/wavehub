import { MigrationInterface, QueryRunner } from 'typeorm';

// Owner 2026-10-15:
// - "I can't delete a coach, only suspend, and the profile still says Coach": a coach with session
//   history can't be hard-deleted (sessions carry payment history), so staff "remove" them —
//   `removedAt` hides the profile everywhere and drops the Coach title, keeping the history.
// - "I can't choose the order of the home coach cards": `homeOrder` (staff-set, smallest first).
// - "users choose what their profile says (Seller, Coach, …); admins can edit it too":
//   `profileTitle` (null = automatic) and whether staff set it.
export class CoachRemovalProfileTitle1784385000000 implements MigrationInterface {
  name = 'CoachRemovalProfileTitle1784385000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "coaches" ADD "removedAt" TIMESTAMPTZ NULL`);
    await queryRunner.query(`ALTER TABLE "coaches" ADD "homeOrder" integer NULL`);
    await queryRunner.query(`ALTER TABLE "users" ADD "profileTitle" varchar(30) NULL`);
    await queryRunner.query(`ALTER TABLE "users" ADD "profileTitleByStaff" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "CHK_users_profile_title" CHECK ("profileTitle" IS NULL OR "profileTitle" IN ('player', 'seller', 'coach', 'pro_player', 'streamer', 'content_creator', 'collector'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "CHK_users_profile_title"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "profileTitleByStaff"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "profileTitle"`);
    await queryRunner.query(`ALTER TABLE "coaches" DROP COLUMN "homeOrder"`);
    await queryRunner.query(`ALTER TABLE "coaches" DROP COLUMN "removedAt"`);
  }
}
