import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/database/base.entity';

export enum ReportReason {
  PRICE_DECEPTION = 'price_deception',
  DESIGN_THEFT = 'design_theft',
  PROXY_ARTIST = 'proxy_artist',
  FALSE_INFO = 'false_info',
  ETC = 'etc',
}

export enum ReportTargetType {
  ARTIST = 'artist',
  USER = 'user',
  POST = 'post',
}

export enum ReportStatus {
  PENDING = 'pending',
  REVIEWING = 'reviewing',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

/** 즉시 제재 사유 — 누적 횟수와 무관하게 바로 처리 */
export const INSTANT_SANCTION_REASONS: ReadonlySet<ReportReason> = new Set([
  ReportReason.DESIGN_THEFT,
  ReportReason.PROXY_ARTIST,
]);

/** 누적 제재 임계치 (가격 기망 등) */
export const SANCTION_THRESHOLD = 3;

@Entity('reports')
// 관리자 목록: 상태 필터 + 최신순
@Index('idx_report_status_created', ['status', 'createdAt'])
// 대상별 누적 집계
@Index('idx_report_target', ['targetType', 'targetId'])
// 동일인이 같은 대상을 중복 신고하지 못하도록 차단
@Index('uq_report_reporter_target', ['reporterId', 'targetType', 'targetId'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class Report extends BaseEntity {
  @Column({ type: 'uuid' })
  reporterId: string;

  @Column({ type: 'enum', enum: ReportTargetType })
  targetType: ReportTargetType;

  @Column({ type: 'uuid' })
  targetId: string;

  /** 대상 계정 ID — 제재 실행 대상(게시글 신고 시 작성자) */
  @Column({ type: 'uuid', nullable: true })
  targetUserId: string | null;

  @Column({ type: 'enum', enum: ReportReason })
  reason: ReportReason;

  @Column({ type: 'text', nullable: true })
  detail: string | null;

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.PENDING })
  status: ReportStatus;

  @Column({ type: 'uuid', nullable: true })
  handledBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  handledAt: Date | null;

  @Column({ type: 'text', nullable: true })
  handlerNote: string | null;

  requiresInstantSanction(): boolean {
    return INSTANT_SANCTION_REASONS.has(this.reason);
  }

  isClosed(): boolean {
    return this.status === ReportStatus.RESOLVED || this.status === ReportStatus.DISMISSED;
  }
}
