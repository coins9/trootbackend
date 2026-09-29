import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 홈 피드/검색 핫 쿼리 인덱스 최적화.
 *
 * 근거(artist.service.feed):
 *  - 기본 정렬이 ORDER BY COALESCE("bumpedAt","createdAt") DESC 인데 이 "식(expression)"에
 *    맞는 인덱스가 없어 매 요청마다 전체 정렬이 발생 → 작품이 늘수록 느려짐.
 *  - 장르 필터 w.genres @> :g (jsonb) 에 GIN 인덱스가 없어 순차 스캔.
 *  - 키워드 검색 title/pageName ILIKE '%kw%' 는 앞쪽 와일드카드라 btree 미사용 → 트라이그램 필요
 *    (pg_trgm 은 products 인덱스에서 이미 사용 중이라 확장 추가 불필요).
 *
 * 모두 추가(비파괴) 인덱스이며 데이터에 영향 없음.
 * 대용량 테이블이면 잠금 최소화를 위해 CONCURRENTLY 로 수동 생성해도 된다(운영 메모 참고).
 */
export class AddFeedPerfIndexes1756500000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // 1) 피드 기본 정렬(status + COALESCE(bumpedAt,createdAt) DESC)을 인덱스로 커버.
    //    status 를 선행 컬럼으로 두어 파라미터 바인딩(제네릭 플랜)에서도 안정적으로 사용된다.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_artwork_feed_order"
        ON "artworks" ("status", (COALESCE("bumpedAt","createdAt")) DESC)
    `);

    // 2) 장르 필터(jsonb @>) 용 GIN
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_artwork_genres_gin"
        ON "artworks" USING gin ("genres")
    `);

    // 3) 키워드 검색(ILIKE '%kw%') 용 트라이그램 GIN
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_artwork_title_trgm"
        ON "artworks" USING gin ("title" gin_trgm_ops)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_artist_pagename_trgm"
        ON "artist_pages" USING gin ("pageName" gin_trgm_ops)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_artist_pagename_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_artwork_title_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_artwork_genres_gin"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_artwork_feed_order"`);
  }
}
