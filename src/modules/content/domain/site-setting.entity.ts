import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/database/base.entity';

/**
 * 운영 중 앱 재배포 없이 바꿔야 하는 값들.
 * 관리자에서 수정하면 앱·웹이 즉시 반영한다.
 */
export enum SettingKey {
  /** 비즈니스 카카오톡 채널 홈 URL (http://pf.kakao.com/_xxxxx) */
  KAKAO_CHANNEL_URL = 'kakao_channel_url',
  /** 채널 공개 ID (_xxxxx) — 앱에서 채널 추가/1:1 채팅 딥링크에 사용 */
  KAKAO_CHANNEL_ID = 'kakao_channel_id',
  /** 오픈채팅방 URL — 채널과 별개 */
  KAKAO_OPENCHAT_URL = 'kakao_openchat_url',
  /** 문의 이메일 */
  SUPPORT_EMAIL = 'support_email',
  /** 고객센터 운영시간 안내 문구 */
  SUPPORT_HOURS = 'support_hours',
  /** 공지 배너 문구 (비우면 미노출) */
  NOTICE_BANNER = 'notice_banner',
  /** 왈라(Walla) 링크아웃 배너 URL — 비우면 앱 내부 등록으로 폴백 */
  BANNER_BEGINNER_URL = 'banner_beginner_url',
  BANNER_SUPPLY_URL = 'banner_supply_url',
  BANNER_MEDIA_URL = 'banner_media_url',
  BANNER_BOOTH_URL = 'banner_booth_url',
  /** 타투이스트 광고 문의 배너 링크 (AdStats 프로모 배너 2종) */
  AD_INQUIRY_URL = 'ad_inquiry_url',
  PARTNER_INQUIRY_URL = 'partner_inquiry_url',
  /** 홈 상단 루트 배너 (비우면 기본 문구, URL 비우면 탭 무동작) */
  HOME_BANNER_TITLE = 'home_banner_title',
  HOME_BANNER_SUBTITLE = 'home_banner_subtitle',
  HOME_BANNER_URL = 'home_banner_url',
  /** 홈 배너 이미지 URL (WebP 권장, 비우면 텍스트 배너로 폴백) */
  HOME_BANNER_IMAGE = 'home_banner_image',
  /** 샵&매칭 탭별 배너 (부스·모델·미디어) */
  SHOP_BOOTH_BANNER_IMAGE = 'shop_booth_banner_image',
  SHOP_BOOTH_BANNER_URL = 'shop_booth_banner_url',
  SHOP_MODEL_BANNER_IMAGE = 'shop_model_banner_image',
  SHOP_MODEL_BANNER_URL = 'shop_model_banner_url',
  SHOP_MEDIA_BANNER_IMAGE = 'shop_media_banner_image',
  SHOP_MEDIA_BANNER_URL = 'shop_media_banner_url',
  /** 용품샵 배너 */
  SUPPLIES_BANNER_IMAGE = 'supplies_banner_image',
  SUPPLIES_BANNER_URL = 'supplies_banner_url',
  /** 배너 이미지 슬롯 — JSON 배열 [{imageUrl,linkUrl},...] 로 저장 */
  BANNER_BEGINNER_IMAGES = 'banner_beginner_images',
  BANNER_SUPPLY_IMAGES = 'banner_supply_images',
  BANNER_BOOTH_IMAGES = 'banner_booth_images',
  BANNER_MEDIA_IMAGES = 'banner_media_images',
  BANNER_AD_IMAGES = 'banner_ad_images',
  BANNER_PARTNER_IMAGES = 'banner_partner_images',
}

@Entity('site_settings')
export class SiteSetting extends BaseEntity {
  @Index('uq_site_setting_key', { unique: true })
  @Column({ type: 'varchar', length: 64 })
  key: SettingKey;

  @Column({ type: 'text', nullable: true })
  value: string | null;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;
}

/** 설정이 비어 있을 때 사용할 기본값 — 앱에서 빈 화면이 나오지 않게 한다 */
export const SETTING_DEFAULTS: Record<SettingKey, string> = {
  [SettingKey.KAKAO_CHANNEL_URL]: '',
  [SettingKey.KAKAO_CHANNEL_ID]: '',
  [SettingKey.KAKAO_OPENCHAT_URL]: '',
  [SettingKey.SUPPORT_EMAIL]: 'contact@tattooroot.com',
  [SettingKey.SUPPORT_HOURS]: '평일 10:00 ~ 18:00 (주말 · 공휴일 휴무)',
  [SettingKey.NOTICE_BANNER]: '',
  [SettingKey.BANNER_BEGINNER_URL]: '',
  [SettingKey.BANNER_SUPPLY_URL]: '',
  [SettingKey.BANNER_MEDIA_URL]: '',
  [SettingKey.BANNER_BOOTH_URL]: '',
  // 비우면 앱 기본 폼(현재 Tally)로 폴백되므로 기본값은 빈 값으로 둔다
  [SettingKey.AD_INQUIRY_URL]: '',
  [SettingKey.PARTNER_INQUIRY_URL]: '',
  [SettingKey.HOME_BANNER_TITLE]: '',
  [SettingKey.HOME_BANNER_SUBTITLE]: '',
  [SettingKey.HOME_BANNER_URL]: '',
  [SettingKey.HOME_BANNER_IMAGE]: '',
  [SettingKey.SHOP_BOOTH_BANNER_IMAGE]: '',
  [SettingKey.SHOP_BOOTH_BANNER_URL]: '',
  [SettingKey.SHOP_MODEL_BANNER_IMAGE]: '',
  [SettingKey.SHOP_MODEL_BANNER_URL]: '',
  [SettingKey.SHOP_MEDIA_BANNER_IMAGE]: '',
  [SettingKey.SHOP_MEDIA_BANNER_URL]: '',
  [SettingKey.SUPPLIES_BANNER_IMAGE]: '',
  [SettingKey.SUPPLIES_BANNER_URL]: '',
  [SettingKey.BANNER_BEGINNER_IMAGES]: '[]',
  [SettingKey.BANNER_SUPPLY_IMAGES]: '[]',
  [SettingKey.BANNER_BOOTH_IMAGES]: '[]',
  [SettingKey.BANNER_MEDIA_IMAGES]: '[]',
  [SettingKey.BANNER_AD_IMAGES]: '[]',
  [SettingKey.BANNER_PARTNER_IMAGES]: '[]',
};
