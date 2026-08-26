import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotifications1755900000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "user_push_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "deletedAt" timestamptz, "userId" uuid NOT NULL, "token" varchar(500) NOT NULL, "platform" varchar(10) NOT NULL, "installationId" varchar(100) NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "lastSeenAt" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "PK_user_push_tokens" PRIMARY KEY ("id"))`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_push_token" ON "user_push_tokens" ("token") WHERE "deletedAt" IS NULL`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_push_token_user" ON "user_push_tokens" ("userId", "enabled")`);
    await q.query(`CREATE TABLE IF NOT EXISTS "notification_preferences" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "deletedAt" timestamptz, "userId" uuid NOT NULL UNIQUE, "reservationStatus" boolean NOT NULL DEFAULT true, "reservationConfirm" boolean NOT NULL DEFAULT true, "reservationRemind" boolean NOT NULL DEFAULT false, "procedureDone" boolean NOT NULL DEFAULT true, "newReply" boolean NOT NULL DEFAULT true, "favoriteArtist" boolean NOT NULL DEFAULT true, "favoriteWorkStock" boolean NOT NULL DEFAULT true, "favoriteSupplyPrice" boolean NOT NULL DEFAULT false, "shopApplication" boolean NOT NULL DEFAULT true, "event" boolean NOT NULL DEFAULT true, "notice" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_notification_preferences" PRIMARY KEY ("id"))`);
    await q.query(`CREATE TABLE IF NOT EXISTS "user_notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "deletedAt" timestamptz, "userId" uuid NOT NULL, "type" varchar(50) NOT NULL, "titleKo" varchar(200) NOT NULL, "titleEn" varchar(200) NOT NULL, "bodyKo" text NOT NULL, "bodyEn" text NOT NULL, "data" jsonb NOT NULL DEFAULT '{}', "idempotencyKey" varchar(200), "readAt" timestamptz, "pushAttemptedAt" timestamptz, "pushError" text, CONSTRAINT "PK_user_notifications" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_user_notification_feed" ON "user_notifications" ("userId", "createdAt")`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_notification_idempotency" ON "user_notifications" ("userId", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL AND "deletedAt" IS NULL`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "user_notifications"`);
    await q.query(`DROP TABLE IF EXISTS "notification_preferences"`);
    await q.query(`DROP TABLE IF EXISTS "user_push_tokens"`);
  }
}
