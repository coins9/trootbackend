import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/database/base.entity';

export enum ReservationStatus {
  /** 고객이 신청, 타투이스트 확인 대기 */
  REQUESTED = 'requested',
  /** 타투이스트 승인, 예약금 대기 */
  CONFIRMED = 'confirmed',
  /** 예약금 입금 완료 */
  DEPOSIT_PAID = 'deposit_paid',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  /** 노쇼 */
  NO_SHOW = 'no_show',
}

export enum DepositStatus {
  NONE = 'none',
  PENDING = 'pending',
  PAID = 'paid',
  REFUNDED = 'refunded',
}

@Entity('reservations')
// 고객 목록
@Index('idx_reservation_customer', ['customerId', 'status', 'scheduledAt'])
// 타투이스트 일정 — 캘린더 조회
@Index('idx_reservation_artist_schedule', ['artistPageId', 'scheduledAt'])
// 예약금 관리 화면
@Index('idx_reservation_deposit', ['artistPageId', 'depositStatus'])
export class Reservation extends BaseEntity {
  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'uuid' })
  artistPageId: string;

  @Column({ type: 'uuid', nullable: true })
  artworkId: string | null;

  @Column({ type: 'timestamptz' })
  scheduledAt: Date;

  @Column({ type: 'int', default: 60 })
  durationMinutes: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  bodyPart: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  sizePreset: string | null;

  @Column({ type: 'text', nullable: true })
  memo: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  referenceImages: string[];

  @Column({ type: 'int', nullable: true })
  estimatedPriceKrw: number | null;

  @Column({ type: 'enum', enum: ReservationStatus, default: ReservationStatus.REQUESTED })
  status: ReservationStatus;

  // ── 예약금 (노쇼 방지) ──
  @Column({ type: 'int', default: 0 })
  depositKrw: number;

  @Column({ type: 'enum', enum: DepositStatus, default: DepositStatus.NONE })
  depositStatus: DepositStatus;

  @Column({ type: 'timestamptz', nullable: true })
  depositPaidAt: Date | null;

  @Column({ type: 'text', nullable: true })
  cancelReason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  /** 리뷰 작성 가능 여부 판정 — 완료 후 14일 */
  isReviewable(): boolean {
    if (this.status !== ReservationStatus.COMPLETED) return false;
    const days = (Date.now() - this.updatedAt.getTime()) / 86_400_000;
    return days <= 14;
  }
}
