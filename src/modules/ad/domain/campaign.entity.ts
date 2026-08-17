import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/database/base.entity';

export enum AdType {
  /** 슈퍼UP — 횟수권 */
  SUPER_UP = 'superup',
  /** 카드광고 — 목록 고정 노출 기간권 */
  CARD_AD = 'cardad',
  /** 홈 배너 */
  BANNER = 'banner',
}

/**
 * 광고가 노출되는 목록(면).
 * 타투이스트만이 아니라 용품샵·부스쉐어·사진영상도 각자의 목록에서 광고할 수 있다.
 */
export enum AdPlacement {
  /** 타투이스트 작품 피드 (홈) */
  ARTWORK = 'artwork',
  /** 타투용품 마켓 */
  PRODUCT = 'product',
  /** 부스 쉐어 목록 */
  BOOTH = 'booth',
  /** 사진/영상 전문가 목록 */
  MEDIA = 'media',
  /** 타투 모델 구인 목록 */
  MODEL = 'model',
}

export enum CampaignStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  REFUNDED = 'refunded',
}

/** 상품 정의 — 앱 결제 시트와 동일한 가격표 */
export const AD_PRODUCTS = {
  [AdType.SUPER_UP]: [
    { code: 'su1', label: '1회권', price: 8900, quantity: 1 },
    { code: 'su3', label: '3회권', price: 11000, quantity: 3 },
    { code: 'su5', label: '5회권', price: 16000, quantity: 5 },
    { code: 'su10', label: '10회권', price: 29000, quantity: 10 },
  ],
  [AdType.CARD_AD]: [
    { code: 'ca3', label: '3일권', price: 9900, days: 3 },
    { code: 'ca7', label: '7일권', price: 19000, days: 7 },
    { code: 'ca14', label: '14일권', price: 33000, days: 14 },
    { code: 'ca30', label: '30일권', price: 59000, days: 30 },
  ],
  [AdType.BANNER]: [
    { code: 'ba3', label: '3일권', price: 19000, days: 3 },
    { code: 'ba7', label: '7일권', price: 35000, days: 7 },
    { code: 'ba14', label: '14일권', price: 59000, days: 14 },
    { code: 'ba30', label: '30일권', price: 99000, days: 30 },
  ],
} as const;

@Entity('ad_campaigns')
// 세그먼트별 노출 조회 — (면 + 유형 + 지역 + 장르 + 상태)로 슬롯을 찾는다
@Index('idx_campaign_segment', ['placement', 'type', 'status', 'regionKey', 'genreKey', 'expiresAt'])
@Index('idx_campaign_owner', ['ownerUserId', 'createdAt'])
export class AdCampaign extends BaseEntity {
  /** 광고를 구매·소유한 사용자 (타투이스트·셀러·글 작성자 공통) */
  @Column({ type: 'uuid' })
  ownerUserId: string;

  /** 노출 면 — 어느 목록에서 광고할지 */
  @Column({ type: 'enum', enum: AdPlacement, default: AdPlacement.ARTWORK })
  placement: AdPlacement;

  /** 광고 대상 항목 (작품·상품·게시글 id). 배너는 null */
  @Column({ type: 'uuid', nullable: true })
  targetId: string | null;

  @Column({ type: 'enum', enum: AdType })
  type: AdType;

  /**
   * 노출 세그먼트 — 이 광고가 어느 지역/장르 피드에 뜰지 결정한다.
   * null = 전국/전체(배너 등). 광고비가 관련 유저에게만 쓰이도록 스코프를 좁힌다.
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  regionKey: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  genreKey: string | null;

  @Column({ type: 'varchar', length: 20 })
  productCode: string;

  @Column({ type: 'varchar', length: 50 })
  planLabel: string;

  @Column({ type: 'int' })
  priceKrw: number;

  /** 슈퍼UP 잔여 횟수 */
  @Column({ type: 'int', default: 0 })
  remainingCount: number;

  @Column({ type: 'enum', enum: CampaignStatus, default: CampaignStatus.PENDING })
  status: CampaignStatus;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  // 성과 지표
  @Column({ type: 'int', default: 0 })
  impressions: number;

  @Column({ type: 'int', default: 0 })
  clicks: number;

  /**
   * 관리자 강제 노출 가중치. 0 = 일반, 높을수록 세그먼트 상단 고정.
   * 운영이 특정 광고/작품을 정책적으로 끌어올릴 때 사용(라운드로빈보다 우선).
   */
  @Column({ type: 'int', default: 0 })
  adminPriority: number;

  isRunning(): boolean {
    if (this.status !== CampaignStatus.ACTIVE) return false;
    if (this.expiresAt && this.expiresAt.getTime() < Date.now()) return false;
    return true;
  }
}
