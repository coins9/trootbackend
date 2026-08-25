import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductEnFields1755700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "subtitle" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "nameEn" character varying(200)`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "descriptionEn" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "openChatUrl" character varying(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "storeUrl" character varying(500)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "storeUrl"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "openChatUrl"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "descriptionEn"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "nameEn"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "subtitle"`);
  }
}
