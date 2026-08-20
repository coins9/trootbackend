import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDetailAddressAndShopEnFields1755400000000 implements MigrationInterface {
  name = 'AddDetailAddressAndShopEnFields1755400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "artist_pages" ADD COLUMN IF NOT EXISTS "detailAddress" character varying(200)`,
    );
    await queryRunner.query(
      `ALTER TABLE "shop_posts" ADD COLUMN IF NOT EXISTS "titleEn" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "shop_posts" ADD COLUMN IF NOT EXISTS "descriptionEn" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shop_posts" DROP COLUMN IF EXISTS "descriptionEn"`);
    await queryRunner.query(`ALTER TABLE "shop_posts" DROP COLUMN IF EXISTS "titleEn"`);
    await queryRunner.query(`ALTER TABLE "artist_pages" DROP COLUMN IF EXISTS "detailAddress"`);
  }
}
