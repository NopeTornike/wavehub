import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthTokenTables1784060630294 implements MigrationInterface {
  name = 'CreateAuthTokenTables1784060630294';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "email_verification_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "tokenHash" character varying NOT NULL,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "consumedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_evt_token_hash" UNIQUE ("tokenHash"),
        CONSTRAINT "PK_evt_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_evt_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "password_reset_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "tokenHash" character varying NOT NULL,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "consumedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_prt_token_hash" UNIQUE ("tokenHash"),
        CONSTRAINT "PK_prt_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_prt_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
    await queryRunner.query(`DROP TABLE "email_verification_tokens"`);
  }
}
