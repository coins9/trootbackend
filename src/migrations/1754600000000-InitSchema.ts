import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 초기 스키마.
 * 인덱스는 실제 조회 경로(소셜 로그인 단건, 관리자 목록 필터, 반경 검색)에 맞춰 생성한다.
 */
export class InitSchema1754600000000 implements MigrationInterface {
  name = 'InitSchema1754600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 확장 — Docker 초기화 스크립트를 거치지 않는 환경(매니지드 DB)을 위해 여기서도 보장
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    // ── enum 타입 ────────────────────────────────────────────
    await queryRunner.query(`CREATE TYPE "users_provider_enum" AS ENUM('kakao','google','apple')`);
    await queryRunner.query(`CREATE TYPE "users_role_enum" AS ENUM('USER','TATTOOIST','STUDIO','ADMIN')`);
    await queryRunner.query(`CREATE TYPE "users_status_enum" AS ENUM('active','suspended','banned')`);
    await queryRunner.query(`CREATE TYPE "artist_tier_enum" AS ENUM('main','general','beginner')`);
    await queryRunner.query(
      `CREATE TYPE "report_reason_enum" AS ENUM('price_deception','design_theft','proxy_artist','false_info','etc')`,
    );
    await queryRunner.query(`CREATE TYPE "report_target_type_enum" AS ENUM('artist','user','post')`);
    await queryRunner.query(
      `CREATE TYPE "report_status_enum" AS ENUM('pending','reviewing','resolved','dismissed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "document_slug_enum" AS ENUM('privacy-policy','terms-of-service','account-deletion','community-guidelines','safety-policy','youth-policy','support')`,
    );
    await queryRunner.query(`CREATE TYPE "document_locale_enum" AS ENUM('ko','en')`);
    await queryRunner.query(`CREATE TYPE "document_status_enum" AS ENUM('draft','published')`);

    // ── users ────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "provider" "users_provider_enum" NOT NULL,
        "providerUserId" character varying(191) NOT NULL,
        "email" character varying(191),
        "nickname" character varying(20),
        "profileImage" character varying(500),
        "activeRole" "users_role_enum" NOT NULL DEFAULT 'USER',
        "roles" "users_role_enum" array NOT NULL DEFAULT '{USER}',
        "status" "users_status_enum" NOT NULL DEFAULT 'active',
        "onboarded" boolean NOT NULL DEFAULT false,
        "reportCount" integer NOT NULL DEFAULT 0,
        "language" character varying(2) NOT NULL DEFAULT 'ko',
        "lastLoginAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_user_provider_identity" ON "users" ("provider","providerUserId")`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_user_nickname" ON "users" ("nickname")`);
    await queryRunner.query(
      `CREATE INDEX "idx_user_status_created" ON "users" ("status","createdAt")`,
    );

    // ── artist_pages ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "artist_pages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "userId" uuid NOT NULL,
        "pageName" character varying(100) NOT NULL,
        "handle" character varying(50) NOT NULL,
        "bio" text,
        "profileImage" character varying(500),
        "coverImage" character varying(500),
        "tier" "artist_tier_enum" NOT NULL DEFAULT 'general',
        "isSelectedMaster" boolean NOT NULL DEFAULT false,
        "regionSido" character varying(50),
        "regionSigungu" character varying(50),
        "location" geography(Point,4326),
        "genres" jsonb NOT NULL DEFAULT '[]',
        "rating" numeric(3,2) NOT NULL DEFAULT 0,
        "reviewCount" integer NOT NULL DEFAULT 0,
        "portfolioCount" integer NOT NULL DEFAULT 0,
        "followerCount" integer NOT NULL DEFAULT 0,
        "freeUpUsedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_artist_pages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_artist_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_artist_user" ON "artist_pages" ("userId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_artist_handle" ON "artist_pages" ("handle")`);
    // 부분 인덱스 — 홈 상단 노출 대상만 색인해 크기를 최소화
    await queryRunner.query(`
      CREATE INDEX "idx_artist_selected_master" ON "artist_pages" ("isSelectedMaster","rating")
      WHERE "isSelectedMaster" = true AND "deletedAt" IS NULL
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_artist_region_rating" ON "artist_pages" ("regionSido","regionSigungu","rating")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_artist_updated" ON "artist_pages" ("updatedAt")`);
    // 반경 검색용 GiST
    await queryRunner.query(
      `CREATE INDEX "idx_artist_location" ON "artist_pages" USING GIST ("location")`,
    );

    // ── reports ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "reporterId" uuid NOT NULL,
        "targetType" "report_target_type_enum" NOT NULL,
        "targetId" uuid NOT NULL,
        "targetUserId" uuid,
        "reason" "report_reason_enum" NOT NULL,
        "detail" text,
        "status" "report_status_enum" NOT NULL DEFAULT 'pending',
        "handledBy" uuid,
        "handledAt" TIMESTAMP WITH TIME ZONE,
        "handlerNote" text,
        CONSTRAINT "PK_reports" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_report_status_created" ON "reports" ("status","createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_report_target" ON "reports" ("targetType","targetId")`,
    );
    // 동일인의 중복 신고 차단 (soft delete 된 건은 제외)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_report_reporter_target"
      ON "reports" ("reporterId","targetType","targetId")
      WHERE "deletedAt" IS NULL
    `);

    // ── legal_documents ──────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "legal_documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "slug" "document_slug_enum" NOT NULL,
        "locale" "document_locale_enum" NOT NULL,
        "title" character varying(200) NOT NULL,
        "body" text NOT NULL,
        "status" "document_status_enum" NOT NULL DEFAULT 'draft',
        "version" integer NOT NULL DEFAULT 1,
        "effectiveAt" TIMESTAMP WITH TIME ZONE,
        "publishedAt" TIMESTAMP WITH TIME ZONE,
        "updatedBy" uuid,
        CONSTRAINT "PK_legal_documents" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_legal_slug_locale"
      ON "legal_documents" ("slug","locale")
      WHERE "deletedAt" IS NULL
    `);
    await queryRunner.query(`CREATE INDEX "idx_legal_status" ON "legal_documents" ("status")`);

    // ── site_settings ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "site_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "key" character varying(64) NOT NULL,
        "value" text,
        "updatedBy" uuid,
        CONSTRAINT "PK_site_settings" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_site_setting_key" ON "site_settings" ("key")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "site_settings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "legal_documents"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reports"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "artist_pages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);

    await queryRunner.query(`DROP TYPE IF EXISTS "document_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "document_locale_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "document_slug_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "report_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "report_target_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "report_reason_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "artist_tier_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users_role_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users_provider_enum"`);
  }
}
