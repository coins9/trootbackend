import {
  CanActivate, ExecutionContext, Injectable, SetMetadata, createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { AppException } from '../exceptions/app.exception';
import { ErrorCode } from '../exceptions/error-code';
import { UserRole } from '../../modules/user/domain/user.entity';
import type { AuthenticatedUser } from '../../modules/auth/presentation/jwt.strategy';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'requiredRoles';
export const SKIP_ONBOARDING_KEY = 'skipOnboarding';

/** 토큰 없이 접근 가능한 엔드포인트 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** 지정한 역할 중 하나라도 있으면 통과 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** 온보딩 미완료 상태에서도 호출 가능 (온보딩 API 자체 등) */
export const AllowUnonboarded = () => SetMetadata(SKIP_ONBOARDING_KEY, true);

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest().user as AuthenticatedUser;
    return data ? user?.[data] : user;
  },
);

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest<T>(err: unknown, user: T, info: unknown): T {
    if (err || !user) {
      // 만료와 위조를 구분해줘야 클라이언트가 '재발급 vs 재로그인'을 판단할 수 있다
      const name = (info as Error | undefined)?.name;
      if (name === 'TokenExpiredError') throw new AppException(ErrorCode.TOKEN_EXPIRED);
      throw new AppException(ErrorCode.UNAUTHORIZED);
    }
    return user;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const user = context.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    if (!user) throw new AppException(ErrorCode.UNAUTHORIZED);

    const allowed = required.some((role) => user.roles.includes(role));
    if (!allowed) {
      throw new AppException(
        required.includes(UserRole.ADMIN) ? ErrorCode.ADMIN_ONLY : ErrorCode.FORBIDDEN,
        { details: { required } },
      );
    }
    return true;
  }
}

/** 온보딩(닉네임·역할) 미완료 사용자가 일반 API 를 호출하는 것을 차단 */
@Injectable()
export class OnboardingGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ONBOARDING_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const user = context.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    if (user && !user.onboarded) throw new AppException(ErrorCode.ONBOARDING_REQUIRED);
    return true;
  }
}
