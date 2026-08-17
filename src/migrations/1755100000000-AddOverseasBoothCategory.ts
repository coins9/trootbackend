import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOverseasBoothCategory1755100000000 implements MigrationInterface {
  name = 'AddOverseasBoothCategory1755100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TYPE "shop_post_category_enum" ADD VALUE IF NOT EXISTS 'booth_share_overseas'`);
  }

  public async down(_q: QueryRunner): Promise<void> {
    // PostgreSQL enum 값 제거는 지원되지 않음 — 롤백 시 수동으로 enum 재생성 필요
  }
}
