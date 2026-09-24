import { MigrationInterface, QueryRunner } from 'typeorm';

// Coach profile + list to docs/design-mockups 06 and 14:
// - coaches: rank, videoUrl, quote, coachingStyle, extraGameIds (coach-entered profile content)
// - coaching_session_reviews: a buyer reviews a completed session once; feeds coaches.ratingAvg /
//   ratingCount, which until now nothing populated
// - coach_favorites: the profile's "Add to Wishlist"
export class CoachProfilesReviewsFavorites1784355000000 implements MigrationInterface {
  name = 'CoachProfilesReviewsFavorites1784355000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "coaches" ADD "rank" character varying(40)`);
    await queryRunner.query(`ALTER TABLE "coaches" ADD "videoUrl" character varying(300)`);
    await queryRunner.query(`ALTER TABLE "coaches" ADD "quote" character varying(300)`);
    await queryRunner.query(`ALTER TABLE "coaches" ADD "coachingStyle" text array NOT NULL DEFAULT '{}'`);
    await queryRunner.query(`ALTER TABLE "coaches" ADD "extraGameIds" uuid array NOT NULL DEFAULT '{}'`);

    await queryRunner.query(`
      CREATE TABLE "coaching_session_reviews" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "sessionId" uuid NOT NULL,
        "coachId" uuid NOT NULL,
        "buyerId" uuid NOT NULL,
        "rating" integer NOT NULL,
        "body" character varying(1000),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_coaching_session_reviews" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_coaching_session_reviews_session" UNIQUE ("sessionId"),
        CONSTRAINT "CHK_coaching_session_reviews_rating" CHECK ("rating" BETWEEN 1 AND 5),
        CONSTRAINT "FK_coaching_session_reviews_session" FOREIGN KEY ("sessionId") REFERENCES "coaching_sessions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_coaching_session_reviews_coach" FOREIGN KEY ("coachId") REFERENCES "coaches"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_coaching_session_reviews_buyer" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_coaching_session_reviews_coach" ON "coaching_session_reviews" ("coachId", "createdAt")`);

    await queryRunner.query(`
      CREATE TABLE "coach_favorites" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "coachId" uuid NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_coach_favorites" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_coach_favorites" UNIQUE ("userId", "coachId"),
        CONSTRAINT "FK_coach_favorites_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_coach_favorites_coach" FOREIGN KEY ("coachId") REFERENCES "coaches"("id") ON DELETE CASCADE
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "coach_favorites"`);
    await queryRunner.query(`DROP TABLE "coaching_session_reviews"`);
    for (const column of ['extraGameIds', 'coachingStyle', 'quote', 'videoUrl', 'rank']) {
      await queryRunner.query(`ALTER TABLE "coaches" DROP COLUMN "${column}"`);
    }
  }
}
