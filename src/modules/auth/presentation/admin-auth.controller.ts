import { Body, Controller, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsString } from 'class-validator';
import { timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { Public } from '../../../shared/auth/guards';
import { AppException } from '../../../shared/exceptions/app.exception';
import { ErrorCode } from '../../../shared/exceptions/error-code';
import { User, UserRole } from '../../user/domain/user.entity';

class AdminLoginDto {
  @IsString() id: string;
  @IsString() password: string;
}

/** 길이 노출 없이 상수 시간 비교 */
const safeEqual = (a: string, b: string): boolean => {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
};

/**
 * 관리자 아이디/비밀번호 로그인.
 * 자격은 환경변수(ADMIN_LOGIN_ID / ADMIN_LOGIN_PASSWORD)로 관리하고,
 * 검증되면 DB 의 실제 ADMIN 유저 신원으로 액세스 토큰을 발급한다.
 * (jwt.strategy 가 매 요청마다 DB 유저를 확인하므로 실제 유저가 있어야 한다)
 */
@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  @Public()
  @Post('login')
  async login(@Body() dto: AdminLoginDto): Promise<{ accessToken: string }> {
    const id = process.env.ADMIN_LOGIN_ID ?? '';
    const password = process.env.ADMIN_LOGIN_PASSWORD ?? '';

    if (!id || !password) {
      throw new AppException(ErrorCode.FORBIDDEN, {
        details: { reason: 'ADMIN_LOGIN 환경변수가 설정되지 않았습니다' },
      });
    }
    if (!safeEqual(dto.id, id) || !safeEqual(dto.password, password)) {
      throw new AppException(ErrorCode.UNAUTHORIZED);
    }

    const admin = await this.users
      .createQueryBuilder('u')
      .where(':role = ANY(u.roles)', { role: UserRole.ADMIN })
      .orderBy('u.createdAt', 'ASC')
      .getOne();

    if (!admin) {
      throw new AppException(ErrorCode.ADMIN_ONLY, {
        details: { reason: 'ADMIN 권한 유저가 DB 에 없습니다' },
      });
    }

    const accessToken = await this.jwt.signAsync(
      { sub: admin.id, roles: admin.roles },
      {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: this.config.get<string>('jwt.accessExpiresIn') as never,
      },
    );

    return { accessToken };
  }
}
