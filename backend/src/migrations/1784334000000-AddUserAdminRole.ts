import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserAdminRole1784334000000 implements MigrationInterface {
  name = 'AddUserAdminRole1784334000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "adminRole" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "adminRole"`);
  }
}
