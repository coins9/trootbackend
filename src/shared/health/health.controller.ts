import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../auth/guards';
import { CacheService } from '../cache/cache.service';

@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cache: CacheService,
  ) {}

  /** 컨테이너 liveness — 의존성 검사 없이 즉시 응답 */
  @Public()
  @Get()
  live() {
    return { status: 'ok', uptime: Math.floor(process.uptime()) };
  }

  /** readiness — DB/Redis 연결까지 확인 (배포 시 트래픽 투입 판단용) */
  @Public()
  @Get('ready')
  async ready() {
    const [db, redis] = await Promise.all([
      this.dataSource
        .query('SELECT 1')
        .then(() => true)
        .catch(() => false),
      this.cache
        .set('health:ping', '1', 5_000)
        .then(() => true)
        .catch(() => false),
    ]);

    return { status: db && redis ? 'ok' : 'degraded', db, redis };
  }
}
