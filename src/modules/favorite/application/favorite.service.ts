import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { buildCursorPage } from '../../../shared/http/pagination.dto';
import { Favorite, FavoriteType } from '../domain/favorite.entity';
import { Artwork } from '../../artist/domain/artwork.entity';
import { ArtistPage } from '../../artist/domain/artist.entity';
import { Product } from '../../supply/domain/supply.entity';
import { ShopPost } from '../../shop/domain/shop-post.entity';

/** 찜 + 대상 실데이터 — 목록 화면이 바로 렌더할 수 있게 조인해 내려준다 */
export interface FavoriteWithTarget {
  id: string;
  type: FavoriteType;
  targetId: string;
  createdAt: string;
  target: Artwork | ArtistPage | Product | ShopPost | null;
}

@Injectable()
export class FavoriteService {
  constructor(
    @InjectRepository(Favorite) private readonly favorites: Repository<Favorite>,
    @InjectRepository(Artwork) private readonly artworks: Repository<Artwork>,
    @InjectRepository(ArtistPage) private readonly artists: Repository<ArtistPage>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(ShopPost) private readonly shopPosts: Repository<ShopPost>,
  ) {}

  /** 토글 — 클라이언트가 현재 상태를 몰라도 되게 한다 */
  async toggle(userId: string, type: FavoriteType, targetId: string): Promise<{ favorited: boolean }> {
    const existing = await this.favorites.findOne({
      where: { userId, type, targetId },
      select: { id: true },
    });

    if (existing) {
      await this.favorites.delete(existing.id);
      return { favorited: false };
    }

    await this.favorites.save(this.favorites.create({ userId, type, targetId }));
    return { favorited: true };
  }

  async list(userId: string, type: FavoriteType, cursor: string | undefined, limit: number) {
    const qb = this.favorites
      .createQueryBuilder('f')
      .where('f.userId = :userId', { userId })
      .andWhere('f.type = :type', { type })
      .orderBy('f.createdAt', 'DESC')
      .take(limit + 1);

    if (cursor) qb.andWhere('f.createdAt < :cursor', { cursor: new Date(cursor) });

    const rows = await qb.getMany();
    const page = buildCursorPage(rows, limit, (r) => r.createdAt.toISOString());

    // 대상 실데이터 조인 (타입별 1회 조회)
    const targetMap = await this.loadTargets(type, page.items.map((f) => f.targetId));
    const items: FavoriteWithTarget[] = page.items.map((f) => ({
      id: f.id,
      type: f.type,
      targetId: f.targetId,
      createdAt: f.createdAt.toISOString(),
      target: targetMap.get(f.targetId) ?? null,
    }));

    return { ...page, items };
  }

  /** 찜 대상 실데이터를 타입에 맞는 테이블에서 한 번에 로드 */
  private async loadTargets(
    type: FavoriteType,
    ids: string[],
  ): Promise<Map<string, Artwork | ArtistPage | Product | ShopPost>> {
    if (ids.length === 0) return new Map();

    let rows: { id: string }[] = [];
    switch (type) {
      case 'artwork':
        rows = await this.artworks.find({ where: { id: In(ids) }, relations: { artist: true } });
        break;
      case 'artist':
        rows = await this.artists.find({ where: { id: In(ids) } });
        break;
      case 'supply':
        rows = await this.products.find({ where: { id: In(ids) } });
        break;
      case 'shop_post':
        rows = await this.shopPosts.find({ where: { id: In(ids) } });
        break;
    }
    return new Map(rows.map((r) => [r.id, r as Artwork | ArtistPage | Product | ShopPost]));
  }

  /**
   * 목록 화면에서 여러 항목의 찜 여부를 한 번에 조회.
   * 항목마다 요청하면 N+1 이 되므로 ID 배열로 묶어 1회 쿼리로 처리한다.
   */
  async checkMany(
    userId: string,
    type: FavoriteType,
    targetIds: string[],
  ): Promise<Record<string, boolean>> {
    if (targetIds.length === 0) return {};

    const rows = await this.favorites.find({
      where: { userId, type, targetId: In(targetIds) },
      select: { targetId: true },
    });

    const set = new Set(rows.map((r) => r.targetId));
    return Object.fromEntries(targetIds.map((id) => [id, set.has(id)]));
  }

  async countByTarget(type: FavoriteType, targetId: string): Promise<number> {
    return this.favorites.count({ where: { type, targetId } });
  }
}
