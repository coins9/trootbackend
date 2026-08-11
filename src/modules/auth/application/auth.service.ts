import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { CacheService } from '../../../shared/cache/cache.service';
import { AppException } from '../../../shared/exceptions/app.exception';
import { ErrorCode } from '../../../shared/exceptions/error-code';
import { AuthProvider, User, UserRole, UserStatus } from '../../user/domain/user.entity';
import { SocialVerifierService } from '../infrastructure/social-verifier.service';

export interface JwtPayload {
  sub: string;
  roles: UserRole[];
  /** 리프레시 토큰 무효화(로그아웃/재발급) 판정용 */
  jti?: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    nickname: string | null;
    email: string | null;
    provider: AuthProvider;
    activeRole: UserRole;
    roles: UserRole[];
    profileImage: string | null;
    onboarded: boolean;
    language: string;
  };
}

/** 리프레시 토큰 화이트리스트 키 — 회전(rotation) 시 이전 토큰을 즉시 무효화한다 */
const refreshKey = (userId: string, jti: string) => `auth:refresh:${userId}:${jti}`;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly socialVerifier: SocialVerifierService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {}

  async loginWithSocial(provider: AuthProvider, token: string): Promise<AuthSession> {
    const identity = await this.socialVerifier.verify(provider, token);

    let user = await this.users.findOne({
      where: { provider: identity.provider, providerUserId: identity.providerUserId },
    });

    if (!user) {
      user = this.users.create({
        provider: identity.provider,
        providerUserId: identity.providerUserId,
        email: identity.email ?? null,
        profileImage: identity.profileImage ?? null,
        roles: [UserRole.USER],
        activeRole: UserRole.USER,
        status: UserStatus.ACTIVE,
        onboarded: false,
      });
      user = await this.users.save(user);
    } else {
      this.assertUsable(user);
      // 로그인 시각만 갱신 — 엔티티 전체 save 를 피해 쓰기 비용 절감
      await this.users.update(user.id, { lastLoginAt: new Date() });
    }

    return this.issueSession(user);
  }

  async refresh(refreshToken: string): Promise<AuthSession> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch (cause) {
      throw new AppException(ErrorCode.REFRESH_TOKEN_INVALID, { cause });
    }

    if (!payload.jti) throw new AppException(ErrorCode.REFRESH_TOKEN_INVALID);

    // 화이트리스트에 없으면 이미 회전되었거나 로그아웃된 토큰
    const stored = await this.cache.get<string>(refreshKey(payload.sub, payload.jti));
    if (!stored) throw new AppException(ErrorCode.REFRESH_TOKEN_INVALID);

    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user) throw new AppException(ErrorCode.USER_NOT_FOUND);
    this.assertUsable(user);

    await this.cache.del(refreshKey(payload.sub, payload.jti));
    return this.issueSession(user);
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
      if (payload.jti) await this.cache.del(refreshKey(userId, payload.jti));
    } catch {
      // 이미 만료된 토큰이면 무효화할 대상이 없으므로 정상 종료
    }
  }

  private async issueSession(user: User): Promise<AuthSession> {
    const jti = randomUUID();
    const payload: JwtPayload = { sub: user.id, roles: user.roles };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('jwt.accessSecret'),
        // '30m' 같은 문자열 리터럴 타입을 요구하므로 런타임 값은 캐스팅해서 전달
        expiresIn: this.config.get<string>('jwt.accessExpiresIn') as never,
      }),
      this.jwt.signAsync({ ...payload, jti }, {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: this.config.get<string>('jwt.refreshExpiresIn') as never,
      }),
    ]);

    // 원문 대신 해시를 저장 — 캐시가 유출돼도 토큰을 복원할 수 없다
    const fingerprint = createHash('sha256').update(refreshToken).digest('hex');
    await this.cache.set(refreshKey(user.id, jti), fingerprint, 30 * 24 * 60 * 60 * 1000);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        nickname: user.nickname,
        email: user.email,
        provider: user.provider,
        activeRole: user.activeRole,
        roles: user.roles,
        profileImage: user.profileImage,
        onboarded: user.onboarded,
        language: user.language,
      },
    };
  }

  private assertUsable(user: User): void {
    if (user.status === UserStatus.BANNED) throw new AppException(ErrorCode.USER_BANNED);
    if (user.status === UserStatus.SUSPENDED) throw new AppException(ErrorCode.USER_SUSPENDED);
  }
}
