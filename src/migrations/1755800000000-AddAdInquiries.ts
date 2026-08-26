import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdInquiries1755800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ad_campaigns" ADD COLUMN IF NOT EXISTS "inquiries" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ad_campaigns" DROP COLUMN IF EXISTS "inquiries"`);
  }
}
