import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/database/base.entity';
import { ArtistPage } from './artist.entity';

export enum ArtworkStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  HIDDEN = 'hidden',
}

export enum ArtworkType {
  /** 실제 시술 결과물 */
  TATTOO = 'tattoo',
  /** 도안 */
  DESIGN = 'design',
}

@Entity('artworks')
// 홈 피드: 게시 상태 + 최신순
@Index('idx_artwork_feed', ['status', 'createdAt'])
// 인기순 정렬
@Index('idx_artwork_popular', ['status', 'likeCount'])
// 작가별 포트폴리오
@Index('idx_artwork_artist', ['artistPageId', 'createdAt'])
// 부위/장르 필터
@Index('idx_artwork_bodypart', ['bodyPart'])
export class Artwork extends BaseEntity {
  @Column({ type: 'uuid' })
  artistPageId: string;

  @ManyToOne(() => ArtistPage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'artistPageId' })
  artist?: ArtistPage;

  @Column({ type: 'enum', enum: ArtworkType, default: ArtworkType.TATTOO })
  type: ArtworkType;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  titleEn: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  descriptionEn: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  images: string[];

  @Column({ type: 'varchar', length: 500, nullable: true })
  thumbnail: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  genres: string[];

  @Column({ type: 'varchar', length: 50, nullable: true })
  bodyPart: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  sizePreset: string | null;

  @Column({ type: 'int', nullable: true })
  priceKrw: number | null;

  @Column({ type: 'int', default: 0 })
  likeCount: number;

  @Column({ type: 'int', default: 0 })
  viewCount: number;

  @Column({ type: 'int', default: 0 })
  commentCount: number;

  /** 광고 노출 중 여부 — 앱 포트폴리오의 '광고중' 뱃지 */
  @Column({ type: 'boolean', default: false })
  isPromoted: boolean;

  @Column({ type: 'enum', enum: ArtworkStatus, default: ArtworkStatus.PUBLISHED })
  status: ArtworkStatus;

  /** UP 정렬 기준 — 무료 UP 사용 시 갱신 */
  @Index('idx_artwork_bumped')
  @Column({ type: 'timestamptz', nullable: true })
  bumpedAt: Date | null;
}
