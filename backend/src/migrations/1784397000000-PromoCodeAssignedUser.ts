import { MigrationInterface, QueryRunner } from 'typeorm';

// Personal promo codes (owner 2026-11-14): a code can be locked to one account — anyone else who
// types it is told it isn't valid. Deleting that account deletes its personal codes.
export class PromoCodeAssignedUser1784397000000 implements MigrationInterface {
  name = 'PromoCodeAssignedUser1784397000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "promo_codes" ADD "assignedUserId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "promo_codes" ADD CONSTRAINT "FK_promo_codes_assigned_user" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_promo_codes_assigned_user" ON "promo_codes" ("assignedUserId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_promo_codes_assigned_user"`);
    await queryRunner.query(`ALTER TABLE "promo_codes" DROP CONSTRAINT "FK_promo_codes_assigned_user"`);
    await queryRunner.query(`ALTER TABLE "promo_codes" DROP COLUMN "assignedUserId"`);
  }
}
