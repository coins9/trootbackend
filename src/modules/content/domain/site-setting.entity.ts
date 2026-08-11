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
  /** 문의 이메일 */
  SUPPORT_EMAIL = 'support_email',
  /** 고객센터 운영시간 안내 문구 */
  SUPPORT_HOURS = 'support_hours',
  /** 공지 배너 문구 (비우면 미노출) */
  NOTICE_BANNER = 'notice_banner',
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
  [SettingKey.SUPPORT_EMAIL]: 'contact@tattooroot.com',
  [SettingKey.SUPPORT_HOURS]: '평일 10:00 ~ 18:00 (주말 · 공휴일 휴무)',
  [SettingKey.NOTICE_BANNER]: '',
};
