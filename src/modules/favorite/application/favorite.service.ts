import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { buildCursorPage } from '../../../shared/http/pagination.dto';
import { Favorite, FavoriteType } from '../domain/favorite.entity';

@Injectable()
export class FavoriteService {
  constructor(
    @InjectRepository(Favorite) private readonly favorites: Repository<Favorite>,
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
    return buildCursorPage(rows, limit, (r) => r.createdAt.toISOString());
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
