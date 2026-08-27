import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/database/base.entity';

export type PersonalEventKind = 'procedure' | 'consulting' | 'retouch' | 'meeting';
export type PersonalEventStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
export type PersonalDepositStatus = 'none' | 'partial' | 'paid';

@Entity('artist_personal_events')
@Index('idx_personal_event_artist_date', ['artistPageId', 'date'])
export class ArtistPersonalEvent extends BaseEntity {
  @Column({ type: 'uuid' })
  artistPageId: string;

  /** YYYY-MM-DD (KST 기준 날짜 — 빠른 날짜 필터링용) */
  @Column({ type: 'char', length: 10 })
  date: string;

  /** 시작 시간 (소수점 표현: 10.5 = 10:30) */
  @Column({ type: 'float' })
  startHour: number;

  /** 소요 시간 (시간 단위: 1.5 = 1h30m) */
  @Column({ type: 'float' })
  durationH: number;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  subtitle: string | null;

  @Column({ type: 'varchar', length: 20 })
  kind: PersonalEventKind;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: PersonalEventStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  customerName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bodyPart: string | null;

  @Column({ type: 'text', nullable: true })
  memo: string | null;

  @Column({ type: 'varchar', length: 10, default: 'none' })
  depositStatus: PersonalDepositStatus;

  @Column({ type: 'int', nullable: true })
  depositAmount: number | null;
}
