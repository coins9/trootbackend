import { IsEnum, IsString, Length, MaxLength } from 'class-validator';
import { AuthProvider } from '../../../user/domain/user.entity';

export class SocialLoginDto {
  @IsEnum(AuthProvider, { message: 'provider must be one of kakao|google|apple' })
  provider: AuthProvider;

  /** 구글/애플은 idToken, 카카오는 accessToken */
  @IsString()
  @Length(10, 4096)
  token: string;
}

export class RefreshTokenDto {
  @IsString()
  @MaxLength(4096)
  refreshToken: string;
}

export class LogoutDto {
  @IsString()
  @MaxLength(4096)
  refreshToken: string;
}
