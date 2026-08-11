/**
 * 환경설정 단일 진입점.
 * DB · Redis 를 별도 서버로 분리 배포하는 것을 전제로 host/port 를 모두 외부 주입받는다.
 */
export interface AppConfig {
  env: 'development' | 'production' | 'test';
  port: number;
  apiPrefix: string;

  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    name: string;
    /** 분리 배포 시 매니지드 DB(SSL 필수) 대응 */
    ssl: boolean;
    /** 커넥션 풀 — 서버 인스턴스당 상한. 비용/커넥션 한도 절약의 핵심 */
    poolSize: number;
    /** 운영에서는 항상 false. 스키마는 마이그레이션으로만 변경한다 */
    synchronize: boolean;
    logging: boolean;
  };

  redis: {
    host: string;
    port: number;
    password?: string;
    /** 캐시 키 충돌 방지용 접두사 (스테이징/운영 공유 시 필수) */
    keyPrefix: string;
    defaultTtlMs: number;
  };

  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
  };

  auth: {
    googleWebClientId?: string;
    googleIosClientId?: string;
    kakaoAdminKey?: string;
    appleBundleId: string;
  };

  throttle: {
    ttlMs: number;
    limit: number;
  };

  /** Cloudflare R2 (S3 호환 오브젝트 스토리지) */
  r2: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    /** 공개 접근 도메인 (R2 커스텀 도메인 또는 r2.dev). 업로드된 파일의 최종 URL 프리픽스 */
    publicBaseUrl: string;
    /** presigned PUT URL 유효시간(초) */
    uploadTtlSec: number;
  };

  /** Cloudflare Tunnel 뒤에 배포된다는 전제 */
  network: {
    rootDomain: string;
    apiDomain: string;
    adminDomain: string;
    /** 허용 Origin. 앱(네이티브)은 Origin 이 없으므로 별도 허용 처리 */
    corsOrigins: string[];
    /**
     * cloudflared 가 앞단에 있으면 req.ip 가 터널 IP 가 된다.
     * true 일 때 CF-Connecting-IP 를 실제 클라이언트 IP 로 사용 (레이트리밋 정확도 확보)
     */
    behindCloudflare: boolean;
  };
}

const int = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const bool = (value: string | undefined, fallback = false): boolean =>
  value === undefined ? fallback : value === 'true' || value === '1';

export default (): AppConfig => ({
  env: (process.env.NODE_ENV as AppConfig['env']) ?? 'development',
  port: int(process.env.PORT, 4000),
  apiPrefix: process.env.API_PREFIX ?? 'api',

  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: int(process.env.DB_PORT, 5432),
    username: process.env.DB_USER ?? 'troot',
    password: process.env.DB_PASSWORD ?? 'troot',
    name: process.env.DB_NAME ?? 'troot',
    ssl: bool(process.env.DB_SSL, false),
    poolSize: int(process.env.DB_POOL_SIZE, 10),
    synchronize: false,
    logging: bool(process.env.DB_LOGGING, false),
  },

  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: int(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    keyPrefix: process.env.REDIS_PREFIX ?? 'troot:',
    defaultTtlMs: int(process.env.CACHE_TTL_MS, 60_000),
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES ?? '30m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES ?? '30d',
  },

  auth: {
    googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID,
    googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID,
    kakaoAdminKey: process.env.KAKAO_ADMIN_KEY,
    appleBundleId: process.env.APPLE_BUNDLE_ID ?? 'com.troot.app',
  },

  throttle: {
    ttlMs: int(process.env.THROTTLE_TTL_MS, 60_000),
    limit: int(process.env.THROTTLE_LIMIT, 120),
  },

  r2: {
    accountId: process.env.R2_ACCOUNT_ID ?? '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    bucket: process.env.R2_BUCKET ?? 'troot',
    publicBaseUrl: (process.env.R2_PUBLIC_BASE_URL ?? '').replace(/\/$/, ''),
    uploadTtlSec: int(process.env.R2_UPLOAD_TTL_SEC, 300),
  },

  network: (() => {
    const rootDomain = process.env.ROOT_DOMAIN ?? 'tattooroot.com';
    const apiDomain = process.env.API_DOMAIN ?? `api.${rootDomain}`;
    const adminDomain = process.env.ADMIN_DOMAIN ?? `admin.${rootDomain}`;
    const extra = (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    return {
      rootDomain,
      apiDomain,
      adminDomain,
      corsOrigins: [
        `https://${adminDomain}`,
        `https://${rootDomain}`,
        `https://www.${rootDomain}`,
        // 로컬 개발용 (운영에서는 CORS_ORIGINS 로만 제어)
        'http://localhost:5173',
        ...extra,
      ],
      behindCloudflare: bool(process.env.BEHIND_CLOUDFLARE, false),
    };
  })(),
});
