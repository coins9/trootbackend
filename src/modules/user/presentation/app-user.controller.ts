import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, Query } from '@nestjs/common';
import { IsEnum, IsString, Length, MaxLength } from 'class-validator';
import { AllowUnonboarded, CurrentUser } from '../../../shared/auth/guards';
import { UserRole } from '../domain/user.entity';
import { UserService } from '../application/user.service';

class OnboardingDto {
  @IsString()
  @Length(2, 20)
  nickname: string;

  @IsEnum([UserRole.USER, UserRole.TATTOOIST], {
    message: 'role must be USER or TATTOOIST',
  })
  role: UserRole.USER | UserRole.TATTOOIST;
}

class NicknameDto {
  @IsString()
  @Length(2, 20)
  nickname: string;
}

class LanguageDto {
  @IsString()
  @Length(2, 5)
  language: string;
}

class SwitchRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}

class ProfileImageDto {
  @IsString()
  @Length(1, 500)
  profileImage: string;
}

class FcmTokenDto {
  @IsString()
  @MaxLength(500)
  fcmToken: string;

  @IsEnum(['ios', 'android'])
  platform: 'ios' | 'android';
}

@Controller('app/users')
export class AppUserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @AllowUnonboarded()
  me(@CurrentUser('id') userId: string) {
    return this.userService.getProfile(userId);
  }

  @Post('onboarding')
  @AllowUnonboarded()
  onboarding(@CurrentUser('id') userId: string, @Body() dto: OnboardingDto) {
    return this.userService.completeOnboarding(userId, dto.nickname, dto.role);
  }

  /** 온보딩 화면에서 실시간 중복 확인 */
  @Get('nickname/available')
  @AllowUnonboarded()
  async available(@Query() dto: NicknameDto) {
    return { available: await this.userService.isNicknameAvailable(dto.nickname) };
  }

  @Patch('me/nickname')
  nickname(@CurrentUser('id') userId: string, @Body() dto: NicknameDto) {
    return this.userService.updateNickname(userId, dto.nickname);
  }

  @Patch('me/profile-image')
  updateProfileImage(@CurrentUser('id') userId: string, @Body() dto: ProfileImageDto) {
    return this.userService.updateProfileImage(userId, dto.profileImage);
  }

  @Patch('me/language')
  @AllowUnonboarded()
  async language(@CurrentUser('id') userId: string, @Body() dto: LanguageDto) {
    await this.userService.updateLanguage(userId, dto.language);
    return { language: dto.language };
  }

  @Patch('me/role')
  switchRole(@CurrentUser('id') userId: string, @Body() dto: SwitchRoleDto) {
    return this.userService.switchRole(userId, dto.role);
  }

  @Patch('me/fcm-token')
  @AllowUnonboarded()
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateFcmToken(@CurrentUser('id') userId: string, @Body() dto: FcmTokenDto) {
    await this.userService.updateFcmToken(userId, dto.fcmToken, dto.platform);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  withdraw(@CurrentUser('id') userId: string) {
    return this.userService.withdraw(userId);
  }
}
