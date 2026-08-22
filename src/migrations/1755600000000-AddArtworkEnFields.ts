import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddArtworkEnFields1755600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "artworks" ADD COLUMN IF NOT EXISTS "titleEn" character varying(200)`,
    );
    await queryRunner.query(
      `ALTER TABLE "artworks" ADD COLUMN IF NOT EXISTS "descriptionEn" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "artworks" DROP COLUMN IF EXISTS "descriptionEn"`);
    await queryRunner.query(`ALTER TABLE "artworks" DROP COLUMN IF EXISTS "titleEn"`);
  }
}
