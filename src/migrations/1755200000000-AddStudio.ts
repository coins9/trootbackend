import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStudio1755200000000 implements MigrationInterface {
  name = 'AddStudio1755200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TYPE studio_member_role_enum AS ENUM ('owner', 'artist', 'pending')
    `);

    await q.query(`
      CREATE TABLE studios (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deletedAt" TIMESTAMPTZ,
        name VARCHAR(100) NOT NULL,
        address TEXT NOT NULL,
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        "ownerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "inviteCode" VARCHAR(10) NOT NULL,
        "inviteCodeExpiresAt" TIMESTAMPTZ
      )
    `);

    await q.query(`
      CREATE UNIQUE INDEX uq_studio_invite_code
        ON studios ("inviteCode")
        WHERE "deletedAt" IS NULL
    `);

    await q.query(`
      CREATE TABLE studio_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deletedAt" TIMESTAMPTZ,
        "studioId" UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
        "userId"   UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
        role studio_member_role_enum NOT NULL DEFAULT 'pending',
        "bedName" VARCHAR(50),
        "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE UNIQUE INDEX uq_studio_member
        ON studio_members ("studioId", "userId")
        WHERE "deletedAt" IS NULL
    `);
    await q.query(`CREATE INDEX idx_studio_member_user ON studio_members ("userId")`);
    await q.query(`CREATE INDEX idx_studio_members_studio ON studio_members ("studioId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS studio_members`);
    await q.query(`DROP TABLE IF EXISTS studios`);
    await q.query(`DROP TYPE IF EXISTS studio_member_role_enum`);
  }
}
