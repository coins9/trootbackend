import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { CacheService, CacheTtl } from '../../../shared/cache/cache.service';
import { AppException } from '../../../shared/exceptions/app.exception';
import { ErrorCode } from '../../../shared/exceptions/error-code';
import { User, UserRole, UserStatus } from '../../user/domain/user.entity';
import type { JwtPayload } from '../application/auth.service';

export interface AuthenticatedUser {
  id: string;
  roles: UserRole[];
  status: UserStatus;
  onboarded: boolean;
}

const authUserKey = (id: string) => `auth:user:${id}`;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly cache: CacheService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret')!,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // 매 요청마다 DB 를 치지 않도록 짧게 캐싱. 제재 반영은 최대 15초 지연되지만 부하를 크게 줄인다
    const user = await this.cache.wrap(authUserKey(payload.sub), CacheTtl.SHORT, async () => {
      const found = await this.users.findOne({
        where: { id: payload.sub },
        select: { id: true, roles: true, status: true, onboarded: true },
      });
      return found ?? null;
    });

    if (!user) throw new AppException(ErrorCode.TOKEN_INVALID);
    if (user.status === UserStatus.BANNED) throw new AppException(ErrorCode.USER_BANNED);
    if (user.status === UserStatus.SUSPENDED) throw new AppException(ErrorCode.USER_SUSPENDED);

    return {
      id: user.id,
      roles: user.roles,
      status: user.status,
      onboarded: user.onboarded,
    };
  }
}
