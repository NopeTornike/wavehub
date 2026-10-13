import { MigrationInterface, QueryRunner } from 'typeorm';

// Tournament players become linked WaveHub accounts (tournaments/CLAUDE.md, 2026-10-01): one row per
// player per team, unique per tournament. Existing teams get their captain as the first member (the
// captain's in-game name is the first entry of `members`); older squads' other players stay
// name-only in `tournament_teams.members`.
export class TournamentTeamMembers1784359000000 implements MigrationInterface {
  name = 'TournamentTeamMembers1784359000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tournament_team_members" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "teamId" uuid NOT NULL,
        "tournamentId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "inGameName" varchar(30) NOT NULL,
        "inGameId" varchar(40),
        "position" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tournament_team_members" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tournament_team_members_user" UNIQUE ("tournamentId", "userId"),
        CONSTRAINT "FK_tournament_team_members_team" FOREIGN KEY ("teamId") REFERENCES "tournament_teams"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tournament_team_members_tournament" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tournament_team_members_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_tournament_team_members_team" ON "tournament_team_members" ("teamId")`);
    await queryRunner.query(`CREATE INDEX "IDX_tournament_team_members_user" ON "tournament_team_members" ("userId")`);
    await queryRunner.query(`
      INSERT INTO "tournament_team_members" ("teamId", "tournamentId", "userId", "inGameName", "position", "createdAt")
      SELECT t."id", t."tournamentId", t."captainUserId",
             left(coalesce(nullif(t."members"->>0, ''), u."username"), 30), 0, t."createdAt"
      FROM "tournament_teams" t JOIN "users" u ON u."id" = t."captainUserId"
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tournament_team_members"`);
  }
}
