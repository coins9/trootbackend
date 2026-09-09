import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReservationCustomerContact1756100000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE reservations
        ADD COLUMN IF NOT EXISTS "customerContact" VARCHAR(100)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE reservations
        DROP COLUMN IF EXISTS "customerContact"
    `);
  }
}
