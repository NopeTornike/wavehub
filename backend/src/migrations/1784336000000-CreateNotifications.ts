import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotifications1784336000000 implements MigrationInterface {
  name = 'CreateNotifications1784336000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "type" character varying NOT NULL,
        "title" character varying NOT NULL,
        "body" text NOT NULL,
        "metadata" jsonb,
        "readAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_user" ON "notifications" ("userId")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_unread" ON "notifications" ("userId") WHERE "readAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_notifications_user_unread"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_user"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
  }
}
