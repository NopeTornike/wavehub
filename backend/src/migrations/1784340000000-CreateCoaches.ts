import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCoaches1784340000000 implements MigrationInterface {
  name = 'CreateCoaches1784340000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "coaches" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "gameId" uuid,
        "specialty" character varying NOT NULL,
        "bio" text NOT NULL,
        "languages" text[] NOT NULL DEFAULT '{}',
        "hourlyRateWaveCoin" integer NOT NULL,
        "verificationStatus" character varying NOT NULL DEFAULT 'pending',
        "rejectionReason" text,
        "status" character varying NOT NULL DEFAULT 'active',
        "ratingAvg" numeric(3,2),
        "ratingCount" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_coaches_userId" UNIQUE ("userId"),
        CONSTRAINT "PK_coaches_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_coaches_user" FOREIGN KEY ("userId") REFERENCES "users"("id"),
        CONSTRAINT "FK_coaches_game" FOREIGN KEY ("gameId") REFERENCES "games"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_coaches_verification_status" ON "coaches" ("verificationStatus")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_coaches_verification_status"`);
    await queryRunner.query(`DROP TABLE "coaches"`);
  }
}
