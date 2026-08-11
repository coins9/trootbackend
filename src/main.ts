import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppException } from './shared/exceptions/app.exception';
import { ErrorCode } from './shared/exceptions/error-code';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // 요청 로그는 인터셉터/필터에서 처리하므로 부트 로그만 남긴다
    logger: ['error', 'warn', 'log'],
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('port')!;
  const apiPrefix = config.get<string>('apiPrefix')!;
  const corsOrigins = config.get<string[]>('network.corsOrigins')!;
  const behindCloudflare = config.get<boolean>('network.behindCloudflare')!;

  // cloudflared 가 앞단이면 프록시를 신뢰해야 req.ip/프로토콜이 정확해진다
  if (behindCloudflare) app.set('trust proxy', 1);

  app.setGlobalPrefix(apiPrefix, {
    exclude: ['health', 'health/ready'],
  });
  // /api/v1/... 형태. 계약 변경 시 v2 를 병행 운영할 수 있다
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());

  app.enableCors({
    origin: (origin, callback) => {
      // 네이티브 앱은 Origin 헤더가 없다 → 허용
      if (!origin || corsOrigins.includes(origin)) return callback(null, true);
      callback(new AppException(ErrorCode.FORBIDDEN, { details: { origin } }));
    },
    credentials: true,
    exposedHeaders: ['x-request-id'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(
    `T:ROOT API on :${port}/${apiPrefix} (cloudflare=${behindCloudflare})`,
  );
}

void bootstrap();
