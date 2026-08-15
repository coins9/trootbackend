import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheService, CacheTtl } from '../../../shared/cache/cache.service';
import {
  SETTING_DEFAULTS, SettingKey, SiteSetting,
} from '../domain/site-setting.entity';

export type SettingMap = Record<SettingKey, string>;

export interface BannerImageItem {
  imageUrl: string;
  linkUrl: string;
}

/** 앱·웹에 내려줄 공개 설정 묶음 */
export interface PublicSettings {
  kakaoChannelUrl: string;
  kakaoChannelId: string;
  kakaoOpenChatUrl: string;
  supportEmail: string;
  supportHours: string;
  noticeBanner: string;
  bannerBeginnerUrl: string;
  bannerSupplyUrl: string;
  bannerMediaUrl: string;
  bannerBoothUrl: string;
  adInquiryUrl: string;
  partnerInquiryUrl: string;
  homeBannerTitle: string;
  homeBannerSubtitle: string;
  homeBannerUrl: string;
  homeBannerImage: string;
  shopBoothBannerImage: string;
  shopBoothBannerUrl: string;
  shopModelBannerImage: string;
  shopModelBannerUrl: string;
  shopMediaBannerImage: string;
  shopMediaBannerUrl: string;
  suppliesBannerImage: string;
  suppliesBannerUrl: string;
  /** 언어별 배너 슬롯 — 앱은 현재 언어에 맞는 필드를 사용한다 */
  bannerBeginnerImagesKo: BannerImageItem[];
  bannerBeginnerImagesEn: BannerImageItem[];
  bannerSupplyImagesKo: BannerImageItem[];
  bannerSupplyImagesEn: BannerImageItem[];
  bannerBoothImagesKo: BannerImageItem[];
  bannerBoothImagesEn: BannerImageItem[];
  bannerMediaImagesKo: BannerImageItem[];
  bannerMediaImagesEn: BannerImageItem[];
  bannerAdImagesKo: BannerImageItem[];
  bannerAdImagesEn: BannerImageItem[];
  bannerPartnerImagesKo: BannerImageItem[];
  bannerPartnerImagesEn: BannerImageItem[];
}

const SETTINGS_CACHE_KEY = 'settings:public';

function parseBannerImages(raw: string): BannerImageItem[] {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (item): item is BannerImageItem =>
        typeof item === 'object' && item !== null &&
        typeof item.imageUrl === 'string' && typeof item.linkUrl === 'string',
    );
  } catch {
    return [];
  }
}

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
      kakaoOpenChatUrl: map[SettingKey.KAKAO_OPENCHAT_URL],
      supportEmail: map[SettingKey.SUPPORT_EMAIL],
      supportHours: map[SettingKey.SUPPORT_HOURS],
      noticeBanner: map[SettingKey.NOTICE_BANNER],
      bannerBeginnerUrl: map[SettingKey.BANNER_BEGINNER_URL],
      bannerSupplyUrl: map[SettingKey.BANNER_SUPPLY_URL],
      bannerMediaUrl: map[SettingKey.BANNER_MEDIA_URL],
      bannerBoothUrl: map[SettingKey.BANNER_BOOTH_URL],
      adInquiryUrl: map[SettingKey.AD_INQUIRY_URL],
      partnerInquiryUrl: map[SettingKey.PARTNER_INQUIRY_URL],
      homeBannerTitle: map[SettingKey.HOME_BANNER_TITLE],
      homeBannerSubtitle: map[SettingKey.HOME_BANNER_SUBTITLE],
      homeBannerUrl: map[SettingKey.HOME_BANNER_URL],
      homeBannerImage: map[SettingKey.HOME_BANNER_IMAGE],
      shopBoothBannerImage: map[SettingKey.SHOP_BOOTH_BANNER_IMAGE],
      shopBoothBannerUrl: map[SettingKey.SHOP_BOOTH_BANNER_URL],
      shopModelBannerImage: map[SettingKey.SHOP_MODEL_BANNER_IMAGE],
      shopModelBannerUrl: map[SettingKey.SHOP_MODEL_BANNER_URL],
      shopMediaBannerImage: map[SettingKey.SHOP_MEDIA_BANNER_IMAGE],
      shopMediaBannerUrl: map[SettingKey.SHOP_MEDIA_BANNER_URL],
      suppliesBannerImage: map[SettingKey.SUPPLIES_BANNER_IMAGE],
      suppliesBannerUrl: map[SettingKey.SUPPLIES_BANNER_URL],
      bannerBeginnerImagesKo: parseBannerImages(map[SettingKey.BANNER_BEGINNER_IMAGES_KO]),
      bannerBeginnerImagesEn: parseBannerImages(map[SettingKey.BANNER_BEGINNER_IMAGES_EN]),
      bannerSupplyImagesKo:   parseBannerImages(map[SettingKey.BANNER_SUPPLY_IMAGES_KO]),
      bannerSupplyImagesEn:   parseBannerImages(map[SettingKey.BANNER_SUPPLY_IMAGES_EN]),
      bannerBoothImagesKo:    parseBannerImages(map[SettingKey.BANNER_BOOTH_IMAGES_KO]),
      bannerBoothImagesEn:    parseBannerImages(map[SettingKey.BANNER_BOOTH_IMAGES_EN]),
      bannerMediaImagesKo:    parseBannerImages(map[SettingKey.BANNER_MEDIA_IMAGES_KO]),
      bannerMediaImagesEn:    parseBannerImages(map[SettingKey.BANNER_MEDIA_IMAGES_EN]),
      bannerAdImagesKo:       parseBannerImages(map[SettingKey.BANNER_AD_IMAGES_KO]),
      bannerAdImagesEn:       parseBannerImages(map[SettingKey.BANNER_AD_IMAGES_EN]),
      bannerPartnerImagesKo:  parseBannerImages(map[SettingKey.BANNER_PARTNER_IMAGES_KO]),
      bannerPartnerImagesEn:  parseBannerImages(map[SettingKey.BANNER_PARTNER_IMAGES_EN]),
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
