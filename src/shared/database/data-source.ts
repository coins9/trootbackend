import 'dotenv/config';
import { DataSource } from 'typeorm';

/**
 * TypeORM CLI 전용 DataSource (마이그레이션 생성/실행).
 * 런타임 연결은 app.module.ts 의 forRootAsync 가 담당한다.
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'troot',
  password: process.env.DB_PASSWORD ?? 'troot',
  database: process.env.DB_NAME ?? 'troot',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  // 운영 데이터 보호 — 스키마는 마이그레이션으로만 변경한다
  synchronize: false,
});
