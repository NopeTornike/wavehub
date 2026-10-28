import { MigrationInterface, QueryRunner } from 'typeorm';

// Owner 2026-10-28: the tournament dashboard's "Game room" card. Staff open it per team and type that
// team's lobby details (PUBG: room ID / password / slot; CS2: a steam://connect server link). Only the
// players of that team, while it is verified, ever see them (tournaments/CLAUDE.md). Each game gets an
// editable launch link ("Open PUBG MOBILE"), PUBG's seeded with the link the owner sent.
export class TournamentGameRoom1784389000000 implements MigrationInterface {
  name = 'TournamentGameRoom1784389000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tournament_matches" ADD "room" jsonb NOT NULL DEFAULT '{}'`);
    await queryRunner.query(`ALTER TABLE "games" ADD "launchUrl" varchar(500) NULL`);
    await queryRunner.query(
      `UPDATE "games" SET "launchUrl" = 'https://www.pubgmobile.com/ig/universallinks/?adjust=false&module=1008403&viewId=20002' WHERE "slug" = 'pubg-mobile' AND "launchUrl" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "games" DROP COLUMN "launchUrl"`);
    await queryRunner.query(`ALTER TABLE "tournament_matches" DROP COLUMN "room"`);
  }
}
