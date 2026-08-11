import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 광고 일반화 + 세그먼트화.
 *  - 전국 단일 슬롯 → (면 × 지역 × 장르) 세그먼트로 분할
 *  - 타투이스트 전용 → 용품샵·부스쉐어·사진영상 등 모든 면에서 광고 가능(ownerUserId + placement + targetId)
 *  - 관리자 강제 순위(adminPriority) 추가
 */
export class AdSegment1754800000000 implements MigrationInterface {
  name = 'AdSegment1754800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TYPE "ad_placement_enum" AS ENUM('artwork','product','booth','media','model')`,
    );

    // 일반화 컬럼
    await q.query(`ALTER TABLE "ad_campaigns" ADD COLUMN "ownerUserId" uuid`);
    await q.query(
      `ALTER TABLE "ad_campaigns" ADD COLUMN "placement" "ad_placement_enum" NOT NULL DEFAULT 'artwork'`,
    );
    await q.query(`ALTER TABLE "ad_campaigns" ADD COLUMN "targetId" uuid`);
    await q.query(`ALTER TABLE "ad_campaigns" ADD COLUMN "regionKey" character varying(50)`);
    await q.query(`ALTER TABLE "ad_campaigns" ADD COLUMN "genreKey" character varying(50)`);
    await q.query(`ALTER TABLE "ad_campaigns" ADD COLUMN "adminPriority" integer NOT NULL DEFAULT 0`);

    // 기존 데이터 이관: artistPageId→소유자 매핑은 앱 로직에 있으므로 여기선 컬럼만 정리.
    // (신규 프로젝트라 기존 캠페인 데이터는 없다는 전제. 있으면 별도 백필 스크립트 필요)
    await q.query(`ALTER TABLE "ad_campaigns" DROP COLUMN IF EXISTS "artistPageId"`);
    await q.query(`ALTER TABLE "ad_campaigns" DROP COLUMN IF EXISTS "artworkId"`);
    await q.query(`ALTER TABLE "ad_campaigns" ALTER COLUMN "ownerUserId" SET NOT NULL`);

    await q.query(`DROP INDEX IF EXISTS "idx_campaign_active"`);
    await q.query(`DROP INDEX IF EXISTS "idx_campaign_artist"`);
    await q.query(`
      CREATE INDEX "idx_campaign_segment"
      ON "ad_campaigns" ("placement","type","status","regionKey","genreKey","expiresAt")
    `);
    await q.query(`CREATE INDEX "idx_campaign_owner" ON "ad_campaigns" ("ownerUserId","createdAt")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "idx_campaign_owner"`);
    await q.query(`DROP INDEX IF EXISTS "idx_campaign_segment"`);
    await q.query(`ALTER TABLE "ad_campaigns" ADD COLUMN "artworkId" uuid`);
    await q.query(`ALTER TABLE "ad_campaigns" ADD COLUMN "artistPageId" uuid`);
    for (const col of ['adminPriority', 'genreKey', 'regionKey', 'targetId', 'placement', 'ownerUserId']) {
      await q.query(`ALTER TABLE "ad_campaigns" DROP COLUMN IF EXISTS "${col}"`);
    }
    await q.query(`DROP TYPE IF EXISTS "ad_placement_enum"`);
    await q.query(`CREATE INDEX "idx_campaign_active" ON "ad_campaigns" ("status","type","expiresAt")`);
  }
}
