import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddArtistInfoFields1755300000000 implements MigrationInterface {
  name = 'AddArtistInfoFields1755300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "artist_pages" ADD COLUMN IF NOT EXISTS "openChatUrl" character varying(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "artist_pages" ADD COLUMN IF NOT EXISTS "availableHours" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "artist_pages" ADD COLUMN IF NOT EXISTS "closedDay" character varying(100)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "artist_pages" DROP COLUMN IF EXISTS "closedDay"`);
    await queryRunner.query(`ALTER TABLE "artist_pages" DROP COLUMN IF EXISTS "availableHours"`);
    await queryRunner.query(`ALTER TABLE "artist_pages" DROP COLUMN IF EXISTS "openChatUrl"`);
  }
}
