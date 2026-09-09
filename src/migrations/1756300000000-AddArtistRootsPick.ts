import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Root's Pick 큐레이션을 Selected Master 와 분리한다.
 * 별도 boolean 플래그 + 부분 인덱스(대상 행만 색인).
 */
export class AddArtistRootsPick1756300000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE artist_pages
        ADD COLUMN IF NOT EXISTS "isRootsPick" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_artist_roots_pick"
        ON artist_pages ("isRootsPick", "rating")
        WHERE "isRootsPick" = true AND "deletedAt" IS NULL
    `);
    // 배포 직후 Root's Pick 탭이 비지 않도록 기존 Selected Master 를 초기값으로 복사.
    // 이후 관리자 화면에서 서로 독립적으로 편집한다.
    await queryRunner.query(`UPDATE artist_pages SET "isRootsPick" = true WHERE "isSelectedMaster" = true`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_artist_roots_pick"`);
    await queryRunner.query(`ALTER TABLE artist_pages DROP COLUMN IF EXISTS "isRootsPick"`);
  }
}
