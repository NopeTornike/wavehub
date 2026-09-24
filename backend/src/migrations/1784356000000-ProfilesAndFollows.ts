import { MigrationInterface, QueryRunner } from 'typeorm';

// Public profile to docs/design-mockups/12: self-entered "game profile" fields and follows.
export class ProfilesAndFollows1784356000000 implements MigrationInterface {
  name = 'ProfilesAndFollows1784356000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "location" character varying(60)`);
    await queryRunner.query(`ALTER TABLE "users" ADD "tagline" character varying(80)`);
    await queryRunner.query(`ALTER TABLE "users" ADD "platform" character varying(30)`);
    await queryRunner.query(`ALTER TABLE "users" ADD "preferredRole" character varying(40)`);
    await queryRunner.query(`ALTER TABLE "users" ADD "achievement" character varying(80)`);
    await queryRunner.query(`
      CREATE TABLE "user_follows" (
        "followerId" uuid NOT NULL,
        "followeeId" uuid NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_follows" PRIMARY KEY ("followerId", "followeeId"),
        CONSTRAINT "CHK_user_follows_self" CHECK ("followerId" <> "followeeId"),
        CONSTRAINT "FK_user_follows_follower" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_follows_followee" FOREIGN KEY ("followeeId") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_user_follows_followee" ON "user_follows" ("followeeId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_follows"`);
    for (const column of ['achievement', 'preferredRole', 'platform', 'tagline', 'location']) {
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "${column}"`);
    }
  }
}
