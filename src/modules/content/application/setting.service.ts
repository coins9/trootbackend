import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheService, CacheTtl } from '../../../shared/cache/cache.service';
import {
  SETTING_DEFAULTS, SettingKey, SiteSetting,
} from '../domain/site-setting.entity';

export type SettingMap = Record<SettingKey, string>;

/** 앱·웹에 내려줄 공개 설정 묶음 */
export interface PublicSettings {
  kakaoChannelUrl: string;
  kakaoChannelId: string;
  supportEmail: string;
  supportHours: string;
  noticeBanner: string;
}

const SETTINGS_CACHE_KEY = 'settings:public';

@Injectable()
export class SettingService {
  constructor(
    @InjectRepository(SiteSetting) private readonly settings: Repository<SiteSetting>,
    private readonly cache: CacheService,
  ) {}

  /** 공개 설정 조회 — 앱 시작 시 1회 호출되므로 길게 캐싱한다 */
  async getPublic(): Promise<PublicSettings> {
    const map = await this.cache.wrap(SETTINGS_CACHE_KEY, CacheTtl.AGGREGATE, async () => {
      const rows = await this.settings.find();
      const merged = { ...SETTING_DEFAULTS };
      for (const row of rows) {
        if (row.value !== null && row.value !== '') merged[row.key] = row.value;
      }
      return merged;
    });

    return {
      kakaoChannelUrl: map[SettingKey.KAKAO_CHANNEL_URL],
      kakaoChannelId: map[SettingKey.KAKAO_CHANNEL_ID],
      supportEmail: map[SettingKey.SUPPORT_EMAIL],
      supportHours: map[SettingKey.SUPPORT_HOURS],
      noticeBanner: map[SettingKey.NOTICE_BANNER],
    };
  }

  async listForAdmin(): Promise<SettingMap> {
    const rows = await this.settings.find();
    const merged = { ...SETTING_DEFAULTS };
    for (const row of rows) {
      if (row.value !== null) merged[row.key] = row.value;
    }
    return merged;
  }

  /** 여러 키를 한 번에 저장 — 관리자 화면의 '저장' 한 번으로 처리 */
  async updateMany(patch: Partial<SettingMap>, adminId: string): Promise<SettingMap> {
    const entries = Object.entries(patch) as [SettingKey, string][];

    for (const [key, value] of entries) {
      const existing = await this.settings.findOne({ where: { key } });
      if (existing) {
        existing.value = value;
        existing.updatedBy = adminId;
        await this.settings.save(existing);
      } else {
        await this.settings.save(
          this.settings.create({ key, value, updatedBy: adminId }),
        );
      }
    }

    await this.cache.del(SETTINGS_CACHE_KEY);
    return this.listForAdmin();
  }
}
