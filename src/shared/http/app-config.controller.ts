import { Controller, Get, Header } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/guards';
import type { AppConfig } from '../../config/configuration';

/**
 * 앱 부팅 시 조회하는 공개 설정.
 * 로그인 이전에도 호출되므로 @Public.
 * 버전 게이팅 값은 .env(IOS_MIN_VERSION 등)로 제어 → 강제 업데이트 시 서버만 재시작하면 된다.
 */
@Controller('app/config')
@Public()
export class AppConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get('version')
  @Header('Cache-Control', 'public, max-age=300')
  version() {
    return this.config.get<AppConfig['appVersion']>('appVersion');
  }
}
