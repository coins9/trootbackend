import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/database/base.entity';

export enum ShopPostCategory {
  BOOTH_SHARE = 'booth_share',
  BOOTH_SHARE_OVERSEAS = 'booth_share_overseas',
  MODEL_RECRUIT = 'model_recruit',
  MEDIA_EXPERT = 'media_expert',
}

export enum ShopPostStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  HIDDEN = 'hidden',
}

/**
 * 부스 쉐어 · 타투 모델 구인 · 사진/영상 전문가를 한 테이블로 관리한다.
 * 카테고리별 고유 필드는 attributes(jsonb)에 담아 스키마 변경 없이 확장 가능하게 한다.
 */
@Entity('shop_posts')
@Index('idx_shop_post_feed', ['category', 'status', 'createdAt'])
@Index('idx_shop_post_author', ['authorId', 'createdAt'])
@Index('idx_shop_post_region', ['category', 'region'])
export class ShopPost extends BaseEntity {
  @Column({ type: 'uuid' })
  authorId: string;

  @Column({ type: 'enum', enum: ShopPostCategory })
  category: ShopPostCategory;

  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  region: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  images: string[];

  /** 카테고리별 상세: 부스쉐어(가격·베드·조명), 모델구인(재료비·스타일), 전문가(경력·견적) */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  attributes: Record<string, unknown>;

  @Column({ type: 'int', nullable: true })
  priceKrw: number | null;

  /** 카카오 오픈채팅 또는 전화 */
  @Column({ type: 'varchar', length: 300, nullable: true })
  contact: string | null;

  @Column({ type: 'enum', enum: ShopPostStatus, default: ShopPostStatus.OPEN })
  status: ShopPostStatus;

  @Column({ type: 'int', default: 0 })
  viewCount: number;

  @Column({ type: 'int', default: 0 })
  likeCount: number;

  @Column({ type: 'int', default: 0 })
  applicationCount: number;
}

/** 지원/문의 내역 */
@Entity('shop_applications')
@Index('idx_shop_application_post', ['postId', 'createdAt'])
@Index('uq_shop_application', ['postId', 'applicantId'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class ShopApplication extends BaseEntity {
  @Column({ type: 'uuid' })
  postId: string;

  @Column({ type: 'uuid' })
  applicantId: string;

  /** 지원 폼 응답 (성별·나이·희망일 등 카테고리별로 다름) */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  answers: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  message: string | null;
}
