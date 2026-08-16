import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFcmToken1755000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS "fcmToken"    VARCHAR(500),
        ADD COLUMN IF NOT EXISTS "fcmPlatform" VARCHAR(10)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS "fcmToken",
        DROP COLUMN IF EXISTS "fcmPlatform"
    `);
  }
}
