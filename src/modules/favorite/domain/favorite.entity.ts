import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/database/base.entity';

export enum FavoriteType {
  ARTIST = 'artist',
  ARTWORK = 'artwork',
  SHOP_POST = 'shop_post',
  SUPPLY = 'supply',
}

@Entity('favorites')
// 내 찜 목록 — 타입별 조회
@Index('idx_favorite_user', ['userId', 'type', 'createdAt'])
// 중복 찜 차단 + 찜 여부 단건 조회
@Index('uq_favorite', ['userId', 'type', 'targetId'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class Favorite extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: FavoriteType })
  type: FavoriteType;

  @Column({ type: 'uuid' })
  targetId: string;
}
