import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddArtistCountryAndVendorInquiry1755500000000 implements MigrationInterface {
  name = 'AddArtistCountryAndVendorInquiry1755500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "artist_pages" ADD COLUMN IF NOT EXISTS "regionType" character varying(10) NOT NULL DEFAULT 'domestic'`,
    );
    await queryRunner.query(
      `ALTER TABLE "artist_pages" ADD COLUMN IF NOT EXISTS "countryCode" character varying(2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "artist_pages" ADD COLUMN IF NOT EXISTS "countryName" character varying(100)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_artist_country" ON "artist_pages" ("countryCode") WHERE "deletedAt" IS NULL AND "countryCode" IS NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "openChatUrl" character varying(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "inquiryCount" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "vendors" DROP COLUMN IF EXISTS "inquiryCount"`);
    await queryRunner.query(`ALTER TABLE "vendors" DROP COLUMN IF EXISTS "openChatUrl"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_artist_country"`);
    await queryRunner.query(`ALTER TABLE "artist_pages" DROP COLUMN IF EXISTS "countryName"`);
    await queryRunner.query(`ALTER TABLE "artist_pages" DROP COLUMN IF EXISTS "countryCode"`);
    await queryRunner.query(`ALTER TABLE "artist_pages" DROP COLUMN IF EXISTS "regionType"`);
  }
}
