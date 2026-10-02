import { MigrationInterface, QueryRunner } from 'typeorm';

// A 6-digit code alongside the emailed verification link (auth/CLAUDE.md, 2026-10-02): Gmail
// disables every link in a message it files as spam, so the user can type the code on the site
// instead. Stored hashed; 5 wrong tries burn it.
export class EmailVerificationCode1784370000000 implements MigrationInterface {
  name = 'EmailVerificationCode1784370000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "email_verification_tokens" ADD "codeHash" varchar(64), ADD "codeAttempts" integer NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "email_verification_tokens" DROP COLUMN "codeAttempts", DROP COLUMN "codeHash"`);
  }
}
