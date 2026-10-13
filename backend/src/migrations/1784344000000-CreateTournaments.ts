import { MigrationInterface, QueryRunner } from 'typeorm';

// No seed rows — unlike CreateContentPages (static legal-page placeholders every deployment
// needs) or CreatePlatformSettings (a required singleton row), a tournament is genuinely optional
// content an admin creates when there's a real event to announce. Seeding a demo tournament would
// violate the "no fabricated data shown as real" non-negotiable rule (root CLAUDE.md §6) the
// moment it went live.
export class CreateTournaments1784344000000 implements MigrationInterface {
  name = 'CreateTournaments1784344000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tournaments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "gameId" uuid NOT NULL,
        "name" character varying(70) NOT NULL,
        "description" text NOT NULL,
        "prize" character varying(60) NOT NULL,
        "status" character varying NOT NULL DEFAULT 'upcoming',
        "startDate" date NOT NULL,
        "maxPlayers" integer NOT NULL DEFAULT 64,
        "coverImageUrl" character varying,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tournaments_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tournaments_gameId" FOREIGN KEY ("gameId") REFERENCES "games"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tournament_registrations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tournamentId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "registeredAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tournament_registrations_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tournament_registrations_tournamentId_userId" UNIQUE ("tournamentId", "userId"),
        CONSTRAINT "FK_tournament_registrations_tournamentId" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tournament_registrations_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_tournament_registrations_tournamentId" ON "tournament_registrations" ("tournamentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_tournament_registrations_userId" ON "tournament_registrations" ("userId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tournament_registrations"`);
    await queryRunner.query(`DROP TABLE "tournaments"`);
  }
}
