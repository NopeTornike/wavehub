import { MigrationInterface, QueryRunner } from 'typeorm';

// Hand-written to match the existing `User` entity (backend/src/users/user.entity.ts) exactly,
// since no live Postgres instance was available in the environment this migration was authored in
// to run `migration:generate` against. Before trusting this migration in a real environment, run
// it against a fresh database and confirm `synchronize: true` against the same entity produces an
// identical schema (or just run `npm run migration:generate` again to diff — it should report no
// further changes needed).
export class InitUsersTable1784059029467 implements MigrationInterface {
  name = 'InitUsersTable1784059029467';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "username" character varying NOT NULL,
        "firstName" character varying NOT NULL,
        "lastName" character varying NOT NULL,
        "passwordHash" character varying NOT NULL,
        "role" character varying NOT NULL DEFAULT 'buyer',
        CONSTRAINT "UQ_users_username" UNIQUE ("username"),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
