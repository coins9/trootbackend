import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Public } from '../../../shared/auth/guards';
import { AuthService } from '../application/auth.service';
import { LogoutDto, RefreshTokenDto, SocialLoginDto } from './dto/auth.dto';

@Controller('app/auth')
export class AppAuthController {
  constructor(private readonly authService: AuthService) {}

  /** 소셜 로그인 — 앱이 받은 provider 토큰을 검증하고 자체 세션을 발급 */
  @Public()
  @Post('social')
  @HttpCode(HttpStatus.OK)
  // 토큰 검증은 외부 API 호출을 동반하므로 별도로 강하게 제한
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  social(@Body() dto: SocialLoginDto) {
    return this.authService.loginWithSocial(dto.provider, dto.token);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser('id') userId: string, @Body() dto: LogoutDto) {
    await this.authService.logout(userId, dto.refreshToken);
  }
}
