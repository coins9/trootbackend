import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { AdModule } from './modules/ad/ad.module';
import { AdminModule } from './modules/admin/admin.module';
import { ArtistModule } from './modules/artist/artist.module';
import { AuthModule } from './modules/auth/auth.module';
import { FavoriteModule } from './modules/favorite/favorite.module';
import { ReservationModule } from './modules/reservation/reservation.module';
import { ReviewModule } from './modules/review/review.module';
import { ShopModule } from './modules/shop/shop.module';
import { SupplyModule } from './modules/supply/supply.module';
import { ContentModule } from './modules/content/content.module';
import { ReportModule } from './modules/report/report.module';
import { UploadModule } from './modules/upload/upload.module';
import { UserModule } from './modules/user/user.module';
import {
  JwtAuthGuard, OnboardingGuard, RolesGuard,
} from './shared/auth/guards';
import { CacheModule } from './shared/cache/cache.module';
import { AllExceptionsFilter } from './shared/exceptions/all-exceptions.filter';
import { HealthController } from './shared/health/health.controller';
import { MetaController } from './shared/http/meta.controller';
import { ResponseInterceptor } from './shared/http/response.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      cache: true,
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        ssl: config.get<boolean>('database.ssl')
          ? { rejectUnauthorized: false }
          : false,
        autoLoadEntities: true,
        // 스키마 변경은 마이그레이션으로만 — 운영 데이터 유실 방지
        synchronize: false,
        // 프로덕션 컨테이너 부팅 시 대기 중인 마이그레이션을 자동 적용(dist 컴파일본)
        migrations: ['dist/migrations/*.js'],
        migrationsRun: process.env.NODE_ENV === 'production',
        logging: config.get<boolean>('database.logging'),
        // DB 를 별도 서버로 분리하므로 커넥션 상한을 명시해 비용/한도를 통제
        extra: {
          max: config.get<number>('database.poolSize'),
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
        },
      }),
    }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('throttle.ttlMs')!,
            limit: config.get<number>('throttle.limit')!,
          },
        ],
        // Cloudflare Tunnel 뒤에서는 원본 IP 가 헤더로만 전달된다
        getTracker: (req: Record<string, any>) =>
          (req.headers?.['cf-connecting-ip'] as string) ??
          (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
          req.ip,
      }),
    }),

    CacheModule,
    AuthModule,
    UserModule,
    ReportModule,
    ContentModule,
    ArtistModule,
    ReservationModule,
    ReviewModule,
    ShopModule,
    FavoriteModule,
    AdModule,
    SupplyModule,
    AdminModule,
    UploadModule,
  ],
  controllers: [HealthController, MetaController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    // 순서 중요: 인증 → 역할 → 온보딩 → 레이트리밋
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: OnboardingGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
