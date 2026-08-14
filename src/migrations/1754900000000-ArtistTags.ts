import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 타투이스트 편의/특성 태그.
 *  - same_day(당일 시술), open_24h(24시간), parking(주차), female_artist/male_artist
 *  - 아티스트 프로필에서 선택, 타투이스트·작품 페이지에 노출
 */
export class ArtistTags1754900000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "artist_pages" ADD COLUMN IF NOT EXISTS "tags" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "artist_pages" DROP COLUMN IF EXISTS "tags"`);
  }
}
