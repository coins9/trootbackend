import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 예약 요청에 인스타그램/오픈톡 연락 수단을 추가하고,
 * 부위/크기 복수 선택(콤마 결합) 저장을 위해 컬럼 폭을 넓힌다.
 */
export class AddReservationContactChannels1756200000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE reservations
        ADD COLUMN IF NOT EXISTS "customerInstagram" VARCHAR(100),
        ADD COLUMN IF NOT EXISTS "customerOpenChat" VARCHAR(255)
    `);
    await queryRunner.query(`ALTER TABLE reservations ALTER COLUMN "bodyPart" TYPE VARCHAR(255)`);
    await queryRunner.query(`ALTER TABLE reservations ALTER COLUMN "sizePreset" TYPE VARCHAR(255)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE reservations
        DROP COLUMN IF EXISTS "customerInstagram",
        DROP COLUMN IF EXISTS "customerOpenChat"
    `);
    await queryRunner.query(`ALTER TABLE reservations ALTER COLUMN "bodyPart" TYPE VARCHAR(50)`);
    await queryRunner.query(`ALTER TABLE reservations ALTER COLUMN "sizePreset" TYPE VARCHAR(50)`);
  }
}
