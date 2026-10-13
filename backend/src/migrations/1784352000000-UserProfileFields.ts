import { MigrationInterface, QueryRunner } from 'typeorm';

// Profile fields the prototype's Settings page edits and its public profile shows: a short bio,
// an uploaded avatar photo, and up to two "main games" (ids into the games table).
export class UserProfileFields1784352000000 implements MigrationInterface {
  name = 'UserProfileFields1784352000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "bio" varchar(300)`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "avatarUrl" varchar`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "mainGameIds" uuid[] NOT NULL DEFAULT '{}'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "mainGameIds"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatarUrl"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "bio"`);
  }
}
