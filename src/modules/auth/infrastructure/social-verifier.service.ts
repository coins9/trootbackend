import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AppException } from '../../../shared/exceptions/app.exception';
import { ErrorCode } from '../../../shared/exceptions/error-code';
import { AuthProvider } from '../../user/domain/user.entity';

export interface VerifiedIdentity {
  provider: AuthProvider;
  providerUserId: string;
  email?: string;
  displayName?: string;
  profileImage?: string;
}

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URL = new URL('https://appleid.apple.com/auth/keys');
const KAKAO_USER_API = 'https://kapi.kakao.com/v2/user/me';

@Injectable()
export class SocialVerifierService {
  private readonly logger = new Logger(SocialVerifierService.name);
  private readonly google: OAuth2Client;
  private readonly googleAudiences: string[];
  private readonly appleBundleId: string;
  // JWKS 는 내부적으로 키를 캐싱하므로 인스턴스를 재사용해야 매 요청 네트워크 호출을 피한다
  private readonly appleJwks = createRemoteJWKSet(APPLE_JWKS_URL);

  constructor(private readonly config: ConfigService) {
    this.google = new OAuth2Client();
    this.googleAudiences = [
      this.config.get<string>('auth.googleWebClientId'),
      this.config.get<string>('auth.googleIosClientId'),
    ].filter((v): v is string => !!v);
    this.appleBundleId = this.config.get<string>('auth.appleBundleId')!;
  }

  async verify(provider: AuthProvider, token: string): Promise<VerifiedIdentity> {
    switch (provider) {
      case AuthProvider.GOOGLE: return this.verifyGoogle(token);
      case AuthProvider.APPLE: return this.verifyApple(token);
      case AuthProvider.KAKAO: return this.verifyKakao(token);
      default:
        throw new AppException(ErrorCode.SOCIAL_PROVIDER_UNSUPPORTED, {
          details: { provider },
        });
    }
  }

  /** 구글: idToken 서명 + audience 검증 */
  private async verifyGoogle(idToken: string): Promise<VerifiedIdentity> {
    try {
      const ticket = await this.google.verifyIdToken({
        idToken,
        audience: this.googleAudiences,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub) throw new Error('missing sub');

      return {
        provider: AuthProvider.GOOGLE,
        providerUserId: payload.sub,
        email: payload.email,
        displayName: payload.name,
        profileImage: payload.picture,
      };
    } catch (cause) {
      throw new AppException(ErrorCode.SOCIAL_TOKEN_INVALID, {
        details: { provider: 'google' },
        cause,
      });
    }
  }

  /** 애플: identityToken 을 Apple JWKS 로 검증 */
  private async verifyApple(identityToken: string): Promise<VerifiedIdentity> {
    try {
      const { payload } = await jwtVerify(identityToken, this.appleJwks, {
        issuer: APPLE_ISSUER,
        audience: this.appleBundleId,
      });
      if (!payload.sub) throw new Error('missing sub');

      return {
        provider: AuthProvider.APPLE,
        providerUserId: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : undefined,
      };
    } catch (cause) {
      throw new AppException(ErrorCode.SOCIAL_TOKEN_INVALID, {
        details: { provider: 'apple' },
        cause,
      });
    }
  }

  /** 카카오: accessToken 으로 사용자 조회가 성공하면 유효한 토큰 */
  private async verifyKakao(accessToken: string): Promise<VerifiedIdentity> {
    try {
      const res = await fetch(KAKAO_USER_API, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) throw new Error(`kakao api ${res.status}`);

      const body = (await res.json()) as {
        id: number;
        kakao_account?: {
          email?: string;
          profile?: { nickname?: string; profile_image_url?: string };
        };
      };

      return {
        provider: AuthProvider.KAKAO,
        providerUserId: String(body.id),
        email: body.kakao_account?.email,
        displayName: body.kakao_account?.profile?.nickname,
        profileImage: body.kakao_account?.profile?.profile_image_url,
      };
    } catch (cause) {
      throw new AppException(ErrorCode.SOCIAL_TOKEN_INVALID, {
        details: { provider: 'kakao' },
        cause,
      });
    }
  }
}
