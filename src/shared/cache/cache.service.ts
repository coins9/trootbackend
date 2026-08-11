import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';

/** 도메인별 키 네임스페이스 — 무효화 범위를 명확히 하기 위해 문자열을 직접 조합하지 않는다 */
export const CacheKey = {
  artistDetail: (id: string) => `artist:detail:${id}`,
  artistList: (hash: string) => `artist:list:${hash}`,
  selectedMasters: () => 'artist:masters',
  userProfile: (id: string) => `user:profile:${id}`,
  adminDashboard: () => 'admin:dashboard',
  reportPendingCount: () => 'report:pending:count',
} as const;

export const CacheTtl = {
  /** 자주 바뀌지 않는 목록 — 길게 */
  LIST: 120_000,
  /** 단건 상세 */
  DETAIL: 60_000,
  /** 집계/통계 — 실시간성이 낮아 길게 잡아 DB 부하를 크게 줄인다 */
  AGGREGATE: 300_000,
  SHORT: 15_000,
} as const;

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  /**
   * 캐시 우선 조회 후 미스 시에만 loader 실행.
   * 캐시 장애가 요청 실패로 번지지 않도록 모든 캐시 연산은 예외를 삼킨다.
   */
  async wrap<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    try {
      const hit = await this.cache.get<T>(key);
      if (hit !== undefined && hit !== null) return hit;
    } catch (e) {
      this.logger.warn(`cache get failed: ${key}`, e as Error);
    }

    const value = await loader();

    // null 캐싱으로 캐시 관통(cache penetration) 방지
    try {
      await this.cache.set(key, value, ttlMs);
    } catch (e) {
      this.logger.warn(`cache set failed: ${key}`, e as Error);
    }
    return value;
  }

  async del(...keys: string[]): Promise<void> {
    await Promise.all(
      keys.map((k) =>
        this.cache.del(k).catch((e) => this.logger.warn(`cache del failed: ${k}`, e as Error)),
      ),
    );
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      return (await this.cache.get<T>(key)) ?? undefined;
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    try {
      await this.cache.set(key, value, ttlMs);
    } catch (e) {
      this.logger.warn(`cache set failed: ${key}`, e as Error);
    }
  }
}
