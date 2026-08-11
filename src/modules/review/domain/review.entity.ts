import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/database/base.entity';

@Entity('reviews')
// 타투이스트 상세의 리뷰 목록
@Index('idx_review_artist', ['artistPageId', 'createdAt'])
// 예약당 1건만 — 중복 리뷰 차단
@Index('uq_review_reservation', ['reservationId'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class Review extends BaseEntity {
  @Column({ type: 'uuid' })
  reservationId: string;

  @Column({ type: 'uuid' })
  authorId: string;

  @Column({ type: 'uuid' })
  artistPageId: string;

  // 기획서 4항목 (각 1~5)
  @Column({ type: 'smallint' })
  painScore: number;

  @Column({ type: 'smallint' })
  kindnessScore: number;

  @Column({ type: 'smallint' })
  hygieneScore: number;

  @Column({ type: 'smallint' })
  satisfactionScore: number;

  /** 4항목 평균 — 정렬·집계에 쓰이므로 저장 시점에 계산해둔다 */
  @Column({ type: 'numeric', precision: 3, scale: 2 })
  averageScore: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  images: string[];

  @Column({ type: 'varchar', length: 50, nullable: true })
  bodyPart: string | null;

  /** 6개월 후 발색 사진 */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  healedImages: string[];

  /** 타투이스트 답글 */
  @Column({ type: 'text', nullable: true })
  reply: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  repliedAt: Date | null;

  @Column({ type: 'boolean', default: false })
  isHidden: boolean;

  static computeAverage(p: number, k: number, h: number, s: number): number {
    return (p + k + h + s) / 4;
  }
}
