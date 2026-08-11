import KeyvRedis from '@keyv/redis';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.get<string>('redis.host');
        const port = config.get<number>('redis.port');
        const password = config.get<string>('redis.password');
        const auth = password ? `:${encodeURIComponent(password)}@` : '';

        const store = new KeyvRedis(`redis://${auth}${host}:${port}`);
        // Redis 다운이 서버 전체 장애로 번지지 않도록 에러를 로그로만 처리
        store.on?.('error', (e: Error) =>
          new Logger('RedisCache').warn(`redis error: ${e.message}`),
        );

        return {
          stores: [store],
          ttl: config.get<number>('redis.defaultTtlMs'),
          namespace: config.get<string>('redis.keyPrefix'),
        };
      },
    }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
