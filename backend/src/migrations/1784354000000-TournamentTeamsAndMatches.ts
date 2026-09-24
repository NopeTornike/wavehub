import { MigrationInterface, QueryRunner } from 'typeorm';

// Tournament teams, prize breakdown and matches (docs/design-mockups 01, 07, 08, 10, 11):
// - tournaments.teamSize (1 = solo) and tournaments.prizes (structured Prize Pool tab)
// - tournament_teams: every registration is a team; existing solo registrations become
//   auto-verified one-player teams named after the user, and their registration row points at it
// - tournament_matches: admin-entered matches with scores and per-player stats
export class TournamentTeamsAndMatches1784354000000 implements MigrationInterface {
  name = 'TournamentTeamsAndMatches1784354000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tournaments" ADD "teamSize" integer NOT NULL DEFAULT 1`);
    await queryRunner.query(
      `ALTER TABLE "tournaments" ADD "prizes" jsonb NOT NULL DEFAULT '{"places":[],"specialRewards":[],"note":null}'`,
    );

    await queryRunner.query(`
      CREATE TABLE "tournament_teams" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tournamentId" uuid NOT NULL,
        "captainUserId" uuid NOT NULL,
        "name" character varying(30) NOT NULL,
        "tag" character varying(6),
        "logoUrl" character varying,
        "coachName" character varying(30),
        "members" jsonb NOT NULL DEFAULT '[]',
        "status" character varying NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tournament_teams" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tournament_teams_captain" UNIQUE ("tournamentId", "captainUserId"),
        CONSTRAINT "FK_tournament_teams_tournament" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tournament_teams_captain" FOREIGN KEY ("captainUserId") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_tournament_teams_tournament" ON "tournament_teams" ("tournamentId")`);
    // Team names are unique within a tournament, case-insensitively.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_tournament_teams_name" ON "tournament_teams" ("tournamentId", lower("name"))`,
    );

    await queryRunner.query(`ALTER TABLE "tournament_registrations" ADD "teamId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "tournament_registrations" ADD CONSTRAINT "FK_tournament_registrations_team" FOREIGN KEY ("teamId") REFERENCES "tournament_teams"("id") ON DELETE CASCADE`,
    );

    // Existing solo registrations → one-player verified teams.
    await queryRunner.query(`
      INSERT INTO "tournament_teams" ("tournamentId", "captainUserId", "name", "members", "status", "createdAt")
      SELECT r."tournamentId", r."userId", left(u."username", 30), jsonb_build_array(u."username"), 'verified', r."registeredAt"
      FROM "tournament_registrations" r JOIN "users" u ON u."id" = r."userId"`);
    await queryRunner.query(`
      UPDATE "tournament_registrations" r SET "teamId" = t."id"
      FROM "tournament_teams" t WHERE t."tournamentId" = r."tournamentId" AND t."captainUserId" = r."userId"`);

    await queryRunner.query(`
      CREATE TABLE "tournament_matches" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tournamentId" uuid NOT NULL,
        "stage" character varying NOT NULL DEFAULT 'group',
        "groupName" character varying(10),
        "roundLabel" character varying(40),
        "teamAId" uuid,
        "teamBId" uuid,
        "map" character varying(40),
        "bestOf" integer NOT NULL DEFAULT 1,
        "scheduledAt" TIMESTAMP WITH TIME ZONE,
        "status" character varying NOT NULL DEFAULT 'scheduled',
        "scoreA" integer,
        "scoreB" integer,
        "stats" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tournament_matches" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tournament_matches_tournament" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tournament_matches_team_a" FOREIGN KEY ("teamAId") REFERENCES "tournament_teams"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_tournament_matches_team_b" FOREIGN KEY ("teamBId") REFERENCES "tournament_teams"("id") ON DELETE SET NULL
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_tournament_matches_tournament" ON "tournament_matches" ("tournamentId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tournament_matches"`);
    await queryRunner.query(`ALTER TABLE "tournament_registrations" DROP CONSTRAINT "FK_tournament_registrations_team"`);
    await queryRunner.query(`ALTER TABLE "tournament_registrations" DROP COLUMN "teamId"`);
    await queryRunner.query(`DROP TABLE "tournament_teams"`);
    await queryRunner.query(`ALTER TABLE "tournaments" DROP COLUMN "prizes"`);
    await queryRunner.query(`ALTER TABLE "tournaments" DROP COLUMN "teamSize"`);
  }
}
