import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPersonalScheduleEvents1756000000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "artist_personal_events" (
        "id"            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deletedAt"     TIMESTAMPTZ,
        "artistPageId"  UUID        NOT NULL REFERENCES artist_pages(id) ON DELETE CASCADE,
        "date"          CHAR(10)    NOT NULL,
        "startHour"     FLOAT       NOT NULL,
        "durationH"     FLOAT       NOT NULL,
        "title"         VARCHAR(200) NOT NULL,
        "subtitle"      VARCHAR(200),
        "kind"          VARCHAR(20) NOT NULL,
        "status"        VARCHAR(20) NOT NULL DEFAULT 'pending',
        "customerName"  VARCHAR(100),
        "bodyPart"      VARCHAR(100),
        "memo"          TEXT,
        "depositStatus" VARCHAR(10) NOT NULL DEFAULT 'none',
        "depositAmount" INT
      )
    `);

    await q.query(`
      CREATE INDEX IF NOT EXISTS "idx_personal_event_artist_date"
        ON "artist_personal_events" ("artistPageId", "date")
        WHERE "deletedAt" IS NULL
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "artist_personal_events"`);
  }
}
