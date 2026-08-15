import { Body, Controller, Get, Header, Patch } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser, Public, Roles } from '../../../shared/auth/guards';
import { UserRole } from '../../user/domain/user.entity';
import { SettingService } from '../application/setting.service';
import { SettingKey } from '../domain/site-setting.entity';

class UpdateSettingsDto {
  @IsOptional() @IsString() @MaxLength(500)
  [SettingKey.KAKAO_CHANNEL_URL]?: string;

  @IsOptional() @IsString() @MaxLength(64)
  [SettingKey.KAKAO_CHANNEL_ID]?: string;

  @IsOptional() @IsString() @MaxLength(191)
  [SettingKey.SUPPORT_EMAIL]?: string;

  @IsOptional() @IsString() @MaxLength(200)
  [SettingKey.SUPPORT_HOURS]?: string;

  @IsOptional() @IsString() @MaxLength(300)
  [SettingKey.NOTICE_BANNER]?: string;

  @IsOptional() @IsString() @MaxLength(500)
  [SettingKey.BANNER_BEGINNER_URL]?: string;

  @IsOptional() @IsString() @MaxLength(500)
  [SettingKey.BANNER_SUPPLY_URL]?: string;

  @IsOptional() @IsString() @MaxLength(500)
  [SettingKey.BANNER_MEDIA_URL]?: string;

  @IsOptional() @IsString() @MaxLength(500)
  [SettingKey.BANNER_BOOTH_URL]?: string;

  @IsOptional() @IsString() @MaxLength(500)
  [SettingKey.AD_INQUIRY_URL]?: string;

  @IsOptional() @IsString() @MaxLength(500)
  [SettingKey.PARTNER_INQUIRY_URL]?: string;

  @IsOptional() @IsString() @MaxLength(60)
  [SettingKey.HOME_BANNER_TITLE]?: string;

  @IsOptional() @IsString() @MaxLength(100)
  [SettingKey.HOME_BANNER_SUBTITLE]?: string;

  @IsOptional() @IsString() @MaxLength(500)
  [SettingKey.HOME_BANNER_URL]?: string;

  @IsOptional() @IsString() @MaxLength(500)
  [SettingKey.HOME_BANNER_IMAGE]?: string;

  @IsOptional() @IsString() @MaxLength(500)
  [SettingKey.KAKAO_OPENCHAT_URL]?: string;

  @IsOptional() @IsString() @MaxLength(500)
  [SettingKey.SHOP_BOOTH_BANNER_IMAGE]?: string;

  @IsOptional() @IsString() @MaxLength(500)
  [SettingKey.SHOP_BOOTH_BANNER_URL]?: string;

  @IsOptional() @IsString() @MaxLength(500)
  [SettingKey.SHOP_MODEL_BANNER_IMAGE]?: string;

  @IsOptional() @IsString() @MaxLength(500)
  [SettingKey.SHOP_MODEL_BANNER_URL]?: string;

  @IsOptional() @IsString() @MaxLength(500)
  [SettingKey.SHOP_MEDIA_BANNER_IMAGE]?: string;

  @IsOptional() @IsString() @MaxLength(500)
  [SettingKey.SHOP_MEDIA_BANNER_URL]?: string;

  @IsOptional() @IsString() @MaxLength(500)
  [SettingKey.SUPPLIES_BANNER_IMAGE]?: string;

  @IsOptional() @IsString() @MaxLength(500)
  [SettingKey.SUPPLIES_BANNER_URL]?: string;
}

/** 앱·웹이 시작 시 읽어가는 공개 설정 */
@Controller('public/settings')
@Public()
export class PublicSettingController {
  constructor(private readonly settingService: SettingService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=120, s-maxage=600, stale-while-revalidate=86400')
  get() {
    return this.settingService.getPublic();
  }
}

@Controller('admin/settings')
@Roles(UserRole.ADMIN)
export class AdminSettingController {
  constructor(private readonly settingService: SettingService) {}

  @Get()
  list() {
    return this.settingService.listForAdmin();
  }

  @Patch()
  update(@Body() dto: UpdateSettingsDto, @CurrentUser('id') adminId: string) {
    return this.settingService.updateMany(dto, adminId);
  }
}
