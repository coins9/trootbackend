import { Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/database/base.entity';
import { User } from '../../user/domain/user.entity';

export enum ArtistTier {
  MAIN = 'main',
  GENERAL = 'general',
  BEGINNER = 'beginner',
}

@Entity('artist_pages')
// 홈 상단 Selected Master 노출 — 부분 인덱스로 대상 행만 색인해 크기를 최소화
@Index('idx_artist_selected_master', ['isSelectedMaster', 'rating'], {
  where: '"isSelectedMaster" = true AND "deletedAt" IS NULL',
})
// 지역 + 평점 정렬 목록
@Index('idx_artist_region_rating', ['regionSido', 'regionSigungu', 'rating'])
// UP 정렬 목록 (updatedAt 기반)
@Index('idx_artist_updated', ['updatedAt'])
export class ArtistPage extends BaseEntity {
  @Index('uq_artist_user', { unique: true })
  @Column({ type: 'uuid' })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'varchar', length: 100 })
  pageName: string;

  @Index('uq_artist_handle', { unique: true })
  @Column({ type: 'varchar', length: 50 })
  handle: string;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  profileImage: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  coverImage: string | null;

  @Column({ type: 'enum', enum: ArtistTier, default: ArtistTier.GENERAL })
  tier: ArtistTier;

  @Column({ type: 'boolean', default: false })
  isSelectedMaster: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  regionSido: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  regionSigungu: string | null;

  /** PostGIS geography — 반경 검색용. 좌표가 없을 수 있어 nullable */
  @Index('idx_artist_location', { spatial: true })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  genres: string[];

  // 집계 컬럼 — 리뷰/작품 테이블 조인 없이 목록을 렌더링하기 위한 비정규화
  @Column({ type: 'numeric', precision: 3, scale: 2, default: 0 })
  rating: string;

  @Column({ type: 'int', default: 0 })
  reviewCount: number;

  @Column({ type: 'int', default: 0 })
  portfolioCount: number;

  @Column({ type: 'int', default: 0 })
  followerCount: number;

  /** 무료 UP 사용 시각 — 24시간 쿨다운 판정 */
  @Column({ type: 'timestamptz', nullable: true })
  freeUpUsedAt: Date | null;
}
