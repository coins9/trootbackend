import { MigrationInterface, QueryRunner } from 'typeorm';

/** 작품 · 예약 · 리뷰 · 샵매칭 · 찜 · 광고 · 마켓 테이블 */
export class DomainTables1754700000000 implements MigrationInterface {
  name = 'DomainTables1754700000000';

  public async up(q: QueryRunner): Promise<void> {
    // ── enum ─────────────────────────────────────────────────
    await q.query(`CREATE TYPE "artwork_status_enum" AS ENUM('draft','published','hidden')`);
    await q.query(`CREATE TYPE "artwork_type_enum" AS ENUM('tattoo','design')`);
    await q.query(
      `CREATE TYPE "reservation_status_enum" AS ENUM('requested','confirmed','deposit_paid','completed','cancelled','no_show')`,
    );
    await q.query(`CREATE TYPE "deposit_status_enum" AS ENUM('none','pending','paid','refunded')`);
    await q.query(
      `CREATE TYPE "shop_post_category_enum" AS ENUM('booth_share','model_recruit','media_expert')`,
    );
    await q.query(`CREATE TYPE "shop_post_status_enum" AS ENUM('open','closed','hidden')`);
    await q.query(
      `CREATE TYPE "favorite_type_enum" AS ENUM('artist','artwork','shop_post','supply')`,
    );
    await q.query(`CREATE TYPE "ad_type_enum" AS ENUM('superup','cardad','banner')`);
    await q.query(
      `CREATE TYPE "campaign_status_enum" AS ENUM('pending','active','completed','refunded')`,
    );
    await q.query(
      `CREATE TYPE "vendor_status_enum" AS ENUM('pending','approved','rejected','suspended')`,
    );
    await q.query(`CREATE TYPE "vendor_entry_phase_enum" AS ENUM('FREE','PAID')`);
    await q.query(
      `CREATE TYPE "product_category_enum" AS ENUM('machine','needle','ink','hygiene','stencil','aftercare','furniture','etc')`,
    );
    await q.query(`CREATE TYPE "settlement_status_enum" AS ENUM('pending','paid')`);

    const base = `
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "deletedAt" TIMESTAMP WITH TIME ZONE
    `;

    // ── artworks ─────────────────────────────────────────────
    await q.query(`
      CREATE TABLE "artworks" (
        ${base},
        "artistPageId" uuid NOT NULL,
        "type" "artwork_type_enum" NOT NULL DEFAULT 'tattoo',
        "title" character varying(200) NOT NULL,
        "description" text,
        "images" jsonb NOT NULL DEFAULT '[]',
        "thumbnail" character varying(500),
        "genres" jsonb NOT NULL DEFAULT '[]',
        "bodyPart" character varying(50),
        "sizePreset" character varying(50),
        "priceKrw" integer,
        "likeCount" integer NOT NULL DEFAULT 0,
        "viewCount" integer NOT NULL DEFAULT 0,
        "commentCount" integer NOT NULL DEFAULT 0,
        "isPromoted" boolean NOT NULL DEFAULT false,
        "status" "artwork_status_enum" NOT NULL DEFAULT 'published',
        "bumpedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_artworks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_artwork_artist" FOREIGN KEY ("artistPageId")
          REFERENCES "artist_pages"("id") ON DELETE CASCADE
      )
    `);
    await q.query(`CREATE INDEX "idx_artwork_feed" ON "artworks" ("status","createdAt")`);
    await q.query(`CREATE INDEX "idx_artwork_popular" ON "artworks" ("status","likeCount")`);
    await q.query(`CREATE INDEX "idx_artwork_artist" ON "artworks" ("artistPageId","createdAt")`);
    await q.query(`CREATE INDEX "idx_artwork_bodypart" ON "artworks" ("bodyPart")`);
    await q.query(`CREATE INDEX "idx_artwork_bumped" ON "artworks" ("bumpedAt")`);

    // ── reservations ─────────────────────────────────────────
    await q.query(`
      CREATE TABLE "reservations" (
        ${base},
        "customerId" uuid NOT NULL,
        "artistPageId" uuid NOT NULL,
        "artworkId" uuid,
        "scheduledAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "durationMinutes" integer NOT NULL DEFAULT 60,
        "bodyPart" character varying(50),
        "sizePreset" character varying(50),
        "memo" text,
        "referenceImages" jsonb NOT NULL DEFAULT '[]',
        "estimatedPriceKrw" integer,
        "status" "reservation_status_enum" NOT NULL DEFAULT 'requested',
        "depositKrw" integer NOT NULL DEFAULT 0,
        "depositStatus" "deposit_status_enum" NOT NULL DEFAULT 'none',
        "depositPaidAt" TIMESTAMP WITH TIME ZONE,
        "cancelReason" text,
        "cancelledAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_reservations" PRIMARY KEY ("id")
      )
    `);
    await q.query(
      `CREATE INDEX "idx_reservation_customer" ON "reservations" ("customerId","status","scheduledAt")`,
    );
    await q.query(
      `CREATE INDEX "idx_reservation_artist_schedule" ON "reservations" ("artistPageId","scheduledAt")`,
    );
    await q.query(
      `CREATE INDEX "idx_reservation_deposit" ON "reservations" ("artistPageId","depositStatus")`,
    );

    // ── reviews ──────────────────────────────────────────────
    await q.query(`
      CREATE TABLE "reviews" (
        ${base},
        "reservationId" uuid NOT NULL,
        "authorId" uuid NOT NULL,
        "artistPageId" uuid NOT NULL,
        "painScore" smallint NOT NULL,
        "kindnessScore" smallint NOT NULL,
        "hygieneScore" smallint NOT NULL,
        "satisfactionScore" smallint NOT NULL,
        "averageScore" numeric(3,2) NOT NULL,
        "body" text NOT NULL,
        "images" jsonb NOT NULL DEFAULT '[]',
        "bodyPart" character varying(50),
        "healedImages" jsonb NOT NULL DEFAULT '[]',
        "reply" text,
        "repliedAt" TIMESTAMP WITH TIME ZONE,
        "isHidden" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_reviews" PRIMARY KEY ("id")
      )
    `);
    await q.query(`CREATE INDEX "idx_review_artist" ON "reviews" ("artistPageId","createdAt")`);
    await q.query(
      `CREATE UNIQUE INDEX "uq_review_reservation" ON "reviews" ("reservationId") WHERE "deletedAt" IS NULL`,
    );

    // ── shop_posts / applications ────────────────────────────
    await q.query(`
      CREATE TABLE "shop_posts" (
        ${base},
        "authorId" uuid NOT NULL,
        "category" "shop_post_category_enum" NOT NULL,
        "title" character varying(100) NOT NULL,
        "description" text NOT NULL,
        "region" character varying(100),
        "images" jsonb NOT NULL DEFAULT '[]',
        "attributes" jsonb NOT NULL DEFAULT '{}',
        "priceKrw" integer,
        "contact" character varying(300),
        "status" "shop_post_status_enum" NOT NULL DEFAULT 'open',
        "viewCount" integer NOT NULL DEFAULT 0,
        "likeCount" integer NOT NULL DEFAULT 0,
        "applicationCount" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_shop_posts" PRIMARY KEY ("id")
      )
    `);
    await q.query(
      `CREATE INDEX "idx_shop_post_feed" ON "shop_posts" ("category","status","createdAt")`,
    );
    await q.query(`CREATE INDEX "idx_shop_post_author" ON "shop_posts" ("authorId","createdAt")`);
    await q.query(`CREATE INDEX "idx_shop_post_region" ON "shop_posts" ("category","region")`);

    await q.query(`
      CREATE TABLE "shop_applications" (
        ${base},
        "postId" uuid NOT NULL,
        "applicantId" uuid NOT NULL,
        "answers" jsonb NOT NULL DEFAULT '{}',
        "message" text,
        CONSTRAINT "PK_shop_applications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_application_post" FOREIGN KEY ("postId")
          REFERENCES "shop_posts"("id") ON DELETE CASCADE
      )
    `);
    await q.query(
      `CREATE INDEX "idx_shop_application_post" ON "shop_applications" ("postId","createdAt")`,
    );
    await q.query(`
      CREATE UNIQUE INDEX "uq_shop_application"
      ON "shop_applications" ("postId","applicantId") WHERE "deletedAt" IS NULL
    `);

    // ── favorites ────────────────────────────────────────────
    await q.query(`
      CREATE TABLE "favorites" (
        ${base},
        "userId" uuid NOT NULL,
        "type" "favorite_type_enum" NOT NULL,
        "targetId" uuid NOT NULL,
        CONSTRAINT "PK_favorites" PRIMARY KEY ("id")
      )
    `);
    await q.query(`CREATE INDEX "idx_favorite_user" ON "favorites" ("userId","type","createdAt")`);
    await q.query(`
      CREATE UNIQUE INDEX "uq_favorite"
      ON "favorites" ("userId","type","targetId") WHERE "deletedAt" IS NULL
    `);

    // ── ad_campaigns ─────────────────────────────────────────
    await q.query(`
      CREATE TABLE "ad_campaigns" (
        ${base},
        "artistPageId" uuid NOT NULL,
        "artworkId" uuid,
        "type" "ad_type_enum" NOT NULL,
        "productCode" character varying(20) NOT NULL,
        "planLabel" character varying(50) NOT NULL,
        "priceKrw" integer NOT NULL,
        "remainingCount" integer NOT NULL DEFAULT 0,
        "status" "campaign_status_enum" NOT NULL DEFAULT 'pending',
        "startedAt" TIMESTAMP WITH TIME ZONE,
        "expiresAt" TIMESTAMP WITH TIME ZONE,
        "impressions" integer NOT NULL DEFAULT 0,
        "clicks" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_ad_campaigns" PRIMARY KEY ("id")
      )
    `);
    await q.query(
      `CREATE INDEX "idx_campaign_active" ON "ad_campaigns" ("status","type","expiresAt")`,
    );
    await q.query(`CREATE INDEX "idx_campaign_artist" ON "ad_campaigns" ("artistPageId","createdAt")`);

    // ── vendors / products / settlements ─────────────────────
    await q.query(`
      CREATE TABLE "vendors" (
        ${base},
        "userId" uuid NOT NULL,
        "name" character varying(200) NOT NULL,
        "businessNo" character varying(50) NOT NULL,
        "ecommerceRegNo" character varying(100),
        "contactEmail" character varying(191) NOT NULL,
        "entryPhase" "vendor_entry_phase_enum" NOT NULL DEFAULT 'FREE',
        "commissionRate" numeric(4,2) NOT NULL DEFAULT 0,
        "status" "vendor_status_enum" NOT NULL DEFAULT 'pending',
        "productCount" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_vendors" PRIMARY KEY ("id")
      )
    `);
    await q.query(`CREATE INDEX "idx_vendor_status" ON "vendors" ("status")`);
    await q.query(
      `CREATE UNIQUE INDEX "uq_vendor_user" ON "vendors" ("userId") WHERE "deletedAt" IS NULL`,
    );

    await q.query(`
      CREATE TABLE "products" (
        ${base},
        "vendorId" uuid NOT NULL,
        "name" character varying(200) NOT NULL,
        "description" text,
        "category" "product_category_enum" NOT NULL,
        "brand" character varying(100),
        "priceKrw" integer NOT NULL,
        "stock" integer NOT NULL DEFAULT 0,
        "images" jsonb NOT NULL DEFAULT '[]',
        "thumbnail" character varying(500),
        "attributes" jsonb NOT NULL DEFAULT '{}',
        "rating" numeric(3,2) NOT NULL DEFAULT 0,
        "reviewCount" integer NOT NULL DEFAULT 0,
        "soldCount" integer NOT NULL DEFAULT 0,
        "externalUrl" character varying(500),
        "isActive" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_products" PRIMARY KEY ("id"),
        CONSTRAINT "FK_product_vendor" FOREIGN KEY ("vendorId")
          REFERENCES "vendors"("id") ON DELETE CASCADE
      )
    `);
    await q.query(
      `CREATE INDEX "idx_product_category" ON "products" ("category","isActive","createdAt")`,
    );
    await q.query(`CREATE INDEX "idx_product_vendor" ON "products" ("vendorId")`);
    // 상품명 부분 검색 최적화
    await q.query(`CREATE INDEX "idx_product_name_trgm" ON "products" USING GIN ("name" gin_trgm_ops)`);

    await q.query(`
      CREATE TABLE "settlements" (
        ${base},
        "vendorId" uuid NOT NULL,
        "period" character varying(7) NOT NULL,
        "grossSalesKrw" integer NOT NULL DEFAULT 0,
        "commissionKrw" integer NOT NULL DEFAULT 0,
        "netPayoutKrw" integer NOT NULL DEFAULT 0,
        "status" "settlement_status_enum" NOT NULL DEFAULT 'pending',
        "dueDate" date,
        "paidAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_settlements" PRIMARY KEY ("id"),
        CONSTRAINT "FK_settlement_vendor" FOREIGN KEY ("vendorId")
          REFERENCES "vendors"("id") ON DELETE CASCADE
      )
    `);
    await q.query(`CREATE INDEX "idx_settlement_vendor" ON "settlements" ("vendorId","period")`);
    await q.query(`CREATE INDEX "idx_settlement_status" ON "settlements" ("status","dueDate")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const table of [
      'settlements', 'products', 'vendors', 'ad_campaigns', 'favorites',
      'shop_applications', 'shop_posts', 'reviews', 'reservations', 'artworks',
    ]) {
      await q.query(`DROP TABLE IF EXISTS "${table}"`);
    }
    for (const type of [
      'settlement_status_enum', 'product_category_enum', 'vendor_entry_phase_enum',
      'vendor_status_enum', 'campaign_status_enum', 'ad_type_enum', 'favorite_type_enum',
      'shop_post_status_enum', 'shop_post_category_enum', 'deposit_status_enum',
      'reservation_status_enum', 'artwork_type_enum', 'artwork_status_enum',
    ]) {
      await q.query(`DROP TYPE IF EXISTS "${type}"`);
    }
  }
}
