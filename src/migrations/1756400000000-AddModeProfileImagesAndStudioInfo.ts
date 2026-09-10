import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 프로필 화면 모드별 사진 분리(용품샵·샵앤매칭)와
 * 샵오너의 주소 밑 자유 정보(소개·영업시간·공지)를 위한 컬럼 추가.
 */
export class AddModeProfileImagesAndStudioInfo1756400000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS "profileImage" VARCHAR(500)`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "shopProfileImage" VARCHAR(500)`);
    await queryRunner.query(`ALTER TABLE studios ADD COLUMN IF NOT EXISTS "info" TEXT`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE vendors DROP COLUMN IF EXISTS "profileImage"`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS "shopProfileImage"`);
    await queryRunner.query(`ALTER TABLE studios DROP COLUMN IF EXISTS "info"`);
  }
}
