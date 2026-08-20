import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { CacheKey, CacheService, CacheTtl } from '../../../shared/cache/cache.service';
import { AppException } from '../../../shared/exceptions/app.exception';
import { ErrorCode } from '../../../shared/exceptions/error-code';
import {
  buildCursorPage, type CursorPage, type OffsetPage, type OffsetPaginationQuery,
} from '../../../shared/http/pagination.dto';
import { User, UserRole } from '../../user/domain/user.entity';
import { ArtistPage, ArtistTier } from '../domain/artist.entity';
import { Artwork, ArtworkStatus } from '../domain/artwork.entity';

export interface ArtistListQuery {
  cursor?: string;
  limit: number;
  region?: string;
  genre?: string;
  sort?: 'recent' | 'rating' | 'popular';
  /** 반경 검색 (km) — lat/lng 와 함께 전달 */
  lat?: number;
  lng?: number;
  radiusKm?: number;
}

/** 무료 UP 쿨다운 (기획서: 1일 1회 · 24시간) */
const FREE_UP_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const SELECTED_MASTER_LIMIT = 50;

@Injectable()
export class ArtistService {
  constructor(
    @InjectRepository(ArtistPage) private readonly artists: Repository<ArtistPage>,
    @InjectRepository(Artwork) private readonly artworks: Repository<Artwork>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly cache: CacheService,
  ) {}

  /** 홈 상단 Selected Master — 변경이 드물어 길게 캐싱 */
  async getSelectedMasters(): Promise<ArtistPage[]> {
    return this.cache.wrap(CacheKey.selectedMasters(), CacheTtl.AGGREGATE, () =>
      this.artists.find({
        where: { isSelectedMaster: true },
        order: { rating: 'DESC' },
        take: SELECTED_MASTER_LIMIT,
      }),
    );
  }

  /** 목록 — 커서 기반. limit+1 조회로 COUNT 쿼리를 제거한다 */
  async list(query: ArtistListQuery): Promise<CursorPage<ArtistPage>> {
    const qb = this.artists.createQueryBuilder('a').where('a.deletedAt IS NULL');

    if (query.region) {
      qb.andWhere(
        new Brackets((w) =>
          w.where('a.regionSido = :region', { region: query.region })
            .orWhere('a.regionSigungu = :region', { region: query.region }),
        ),
      );
    }
    // jsonb 배열 포함 검사 — GIN 인덱스 대상
    if (query.genre) {
      qb.andWhere('a.genres @> :genre', { genre: JSON.stringify([query.genre]) });
    }

    // PostGIS 반경 검색: 좌표가 있는 행만, 미터 단위로 비교
    if (query.lat !== undefined && query.lng !== undefined && query.radiusKm) {
      qb.andWhere('a.location IS NOT NULL').andWhere(
        `ST_DWithin(a.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :meters)`,
        { lat: query.lat, lng: query.lng, meters: query.radiusKm * 1000 },
      );
    }

    switch (query.sort) {
      case 'rating': qb.orderBy('a.rating', 'DESC'); break;
      case 'popular': qb.orderBy('a.followerCount', 'DESC'); break;
      default: qb.orderBy('a.updatedAt', 'DESC');
    }
    qb.addOrderBy('a.id', 'DESC');

    if (query.cursor) {
      qb.andWhere('a.updatedAt < :cursor', { cursor: new Date(query.cursor) });
    }

    const rows = await qb.take(query.limit + 1).getMany();
    return buildCursorPage(rows, query.limit, (r) => r.updatedAt.toISOString());
  }

  async getDetail(id: string): Promise<ArtistPage> {
    const artist = await this.cache.wrap(CacheKey.artistDetail(id), CacheTtl.DETAIL, () =>
      this.artists.findOne({ where: { id } }),
    );
    if (!artist) throw new AppException(ErrorCode.ARTIST_NOT_FOUND);
    return artist;
  }

  async getByUserId(userId: string): Promise<ArtistPage> {
    const artist = await this.artists.findOne({ where: { userId } });
    if (!artist) throw new AppException(ErrorCode.ARTIST_NOT_FOUND);
    return artist;
  }

  /** 타투이스트 등록 — 1인 1페이지. 유저에게 TATTOOIST 역할도 부여한다. */
  async createPage(
    userId: string,
    input: { pageName: string; handle: string; bio?: string; regionSido?: string; regionSigungu?: string },
  ): Promise<ArtistPage> {
    const existing = await this.artists.findOne({ where: { userId }, select: { id: true } });
    if (existing) throw new AppException(ErrorCode.ARTIST_ALREADY_EXISTS);

    const duplicatedHandle = await this.artists.findOne({
      where: { handle: input.handle },
      select: { id: true },
    });
    if (duplicatedHandle) {
      throw new AppException(ErrorCode.ARTIST_ALREADY_EXISTS, { details: { handle: input.handle } });
    }

    const page = await this.artists.save(
      this.artists.create({ userId, ...input, tier: ArtistTier.GENERAL }),
    );

    // 아티스트 페이지 생성 = 타투이스트 확정 → 역할 부여 후 인증 캐시 무효화
    const user = await this.users.findOne({ where: { id: userId } });
    if (user && !user.roles.includes(UserRole.TATTOOIST)) {
      user.roles = Array.from(new Set([...user.roles, UserRole.TATTOOIST]));
      user.activeRole = UserRole.TATTOOIST;
      await this.users.save(user);
      await this.cache.del(CacheKey.userProfile(userId), `auth:user:${userId}`);
    }

    return page;
  }

  async updatePage(
    userId: string,
    patch: Partial<ArtistPage> & { lat?: number; lng?: number },
  ): Promise<ArtistPage> {
    const artist = await this.getByUserId(userId);
    // 등급·Master 여부는 운영자만 변경 가능하므로 사용자 입력에서 제외
    const { lat, lng, ...rest } = patch as any;
    delete rest.tier;
    delete rest.isSelectedMaster;
    delete rest.rating;
    delete rest.reviewCount;

    Object.assign(artist, rest);
    const saved = await this.artists.save(artist);

    if (lat !== undefined && lng !== undefined) {
      await this.artists.query(
        `UPDATE artist_pages SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography WHERE id = $3`,
        [lng, lat, artist.id],
      );
    }

    await this.cache.del(CacheKey.artistDetail(artist.id));
    return saved;
  }

  /** 무료 UP — 24시간 쿨다운. 남은 시간을 details 로 내려 클라이언트가 안내할 수 있게 한다 */
  async freeUp(userId: string): Promise<{ bumpedAt: Date }> {
    const artist = await this.getByUserId(userId);
    const now = Date.now();
    const last = artist.freeUpUsedAt?.getTime() ?? 0;
    const elapsed = now - last;

    if (elapsed < FREE_UP_COOLDOWN_MS) {
      throw new AppException(ErrorCode.FREE_UP_COOLDOWN, {
        details: { retryAfterMs: FREE_UP_COOLDOWN_MS - elapsed },
      });
    }

    const bumpedAt = new Date();
    await this.artists.update(artist.id, { freeUpUsedAt: bumpedAt, updatedAt: bumpedAt });
    await this.cache.del(CacheKey.artistDetail(artist.id));
    return { bumpedAt };
  }

  // ── 포트폴리오 ────────────────────────────────────────────

  async listArtworks(artistPageId: string, cursor: string | undefined, limit: number) {
    const qb = this.artworks
      .createQueryBuilder('w')
      .where('w.artistPageId = :artistPageId', { artistPageId })
      .andWhere('w.status = :status', { status: ArtworkStatus.PUBLISHED })
      .orderBy('w.createdAt', 'DESC')
      .take(limit + 1);

    if (cursor) qb.andWhere('w.createdAt < :cursor', { cursor: new Date(cursor) });

    const rows = await qb.getMany();
    return buildCursorPage(rows, limit, (r) => r.createdAt.toISOString());
  }

  /** 홈 피드 — 게시된 작품 전체 (지역/국가 필터 지원) */
  async feed(
    cursor: string | undefined,
    limit: number,
    sort: 'recent' | 'popular' = 'recent',
    filter?: {
      countryCode?: string; regionSido?: string; regionSigungu?: string;
      genre?: string; bodyPart?: string; priceMin?: number; priceMax?: number;
      keyword?: string;
    },
  ) {
    // 다대일(artist) 조인만 있어 행이 늘지 않으므로 limit() 로 직접 제한한다.
    const qb = this.artworks
      .createQueryBuilder('w')
      .leftJoinAndSelect('w.artist', 'a')
      .where('w.status = :status', { status: ArtworkStatus.PUBLISHED })
      .limit(limit + 1);

    if (filter?.countryCode) {
      qb.andWhere('a.countryCode = :countryCode', { countryCode: filter.countryCode });
    } else if (filter?.regionSigungu) {
      qb.andWhere('a.regionSigungu = :regionSigungu', { regionSigungu: filter.regionSigungu });
    } else if (filter?.regionSido) {
      qb.andWhere('a.regionSido = :regionSido', { regionSido: filter.regionSido });
    }

    if (filter?.genre) {
      // 콤마로 구분된 다중 선택 — 하나라도 겹치면 매치 (jsonb 배열이라 @> OR 로 overlap 구현)
      const genreList = filter.genre.split(',').map((g) => g.trim()).filter(Boolean);
      if (genreList.length === 1) {
        qb.andWhere('w.genres @> :genre', { genre: JSON.stringify(genreList) });
      } else if (genreList.length > 1) {
        qb.andWhere(
          new Brackets((w) => {
            genreList.forEach((g, i) => {
              const param = `genre${i}`;
              const cond = `w.genres @> :${param}`;
              if (i === 0) w.where(cond, { [param]: JSON.stringify([g]) });
              else w.orWhere(cond, { [param]: JSON.stringify([g]) });
            });
          }),
        );
      }
    }
    if (filter?.bodyPart) {
      const bodyPartList = filter.bodyPart.split(',').map((b) => b.trim()).filter(Boolean);
      if (bodyPartList.length > 0) {
        qb.andWhere('w.bodyPart IN (:...bodyPartList)', { bodyPartList });
      }
    }
    if (filter?.priceMin != null) {
      qb.andWhere('w.priceKrw >= :priceMin', { priceMin: filter.priceMin });
    }
    if (filter?.priceMax != null && filter.priceMax < 10000000) {
      qb.andWhere('w.priceKrw <= :priceMax', { priceMax: filter.priceMax });
    }

    if (filter?.keyword) {
      const kw = `%${filter.keyword}%`;
      qb.andWhere(
        '(w.title ILIKE :kw OR a.pageName ILIKE :kw OR EXISTS (SELECT 1 FROM unnest(w.genres) g WHERE g ILIKE :kw))',
        { kw },
      );
    }

    if (sort === 'popular') {
      qb.orderBy('w.likeCount', 'DESC').addOrderBy('w.createdAt', 'DESC');
    } else {
      qb.orderBy('COALESCE(w.bumpedAt, w.createdAt)', 'DESC');
    }

    if (cursor) {
      qb.andWhere('COALESCE(w.bumpedAt, w.createdAt) < :cursor', { cursor: new Date(cursor) });
    }

    const rows = await qb.getMany();
    return buildCursorPage(rows, limit, (r) => (r.bumpedAt ?? r.createdAt).toISOString());
  }

  async createArtwork(userId: string, input: Partial<Artwork>): Promise<Artwork> {
    const artist = await this.getByUserId(userId);
    const artwork = await this.artworks.save(
      this.artworks.create({ ...input, artistPageId: artist.id }),
    );
    // 포트폴리오 수는 목록에서 조인 없이 쓰이므로 비정규화 컬럼을 함께 갱신
    await this.artists.increment({ id: artist.id }, 'portfolioCount', 1);
    await this.cache.del(CacheKey.artistDetail(artist.id));
    return artwork;
  }

  async updateArtwork(userId: string, artworkId: string, patch: Partial<Artwork>): Promise<Artwork> {
    const artist = await this.getByUserId(userId);
    const artwork = await this.artworks.findOne({
      where: { id: artworkId, artistPageId: artist.id },
    });
    if (!artwork) throw new AppException(ErrorCode.NOT_FOUND, { details: { artworkId } });

    Object.assign(artwork, patch);
    return this.artworks.save(artwork);
  }

  async deleteArtwork(userId: string, artworkId: string): Promise<void> {
    const artist = await this.getByUserId(userId);
    const result = await this.artworks.softDelete({ id: artworkId, artistPageId: artist.id });
    if (!result.affected) throw new AppException(ErrorCode.NOT_FOUND, { details: { artworkId } });

    await this.artists.decrement({ id: artist.id }, 'portfolioCount', 1);
    await this.cache.del(CacheKey.artistDetail(artist.id));
  }

  // ── 관리자 ────────────────────────────────────────────────

  async listForAdmin(
    query: OffsetPaginationQuery & { tier?: ArtistTier },
  ): Promise<OffsetPage<ArtistPage>> {
    const qb = this.artists
      .createQueryBuilder('a')
      .orderBy('a.createdAt', 'DESC')
      .skip((query.page - 1) * query.size)
      .take(query.size);

    if (query.tier) qb.andWhere('a.tier = :tier', { tier: query.tier });

    const [items, total] = await qb.getManyAndCount();
    return { items, page: query.page, size: query.size, total, totalPages: Math.ceil(total / query.size) };
  }

  /** Selected Master 지정 — 정원 50명 초과 방지 */
  async setSelectedMaster(artistId: string, value: boolean): Promise<ArtistPage> {
    const artist = await this.artists.findOne({ where: { id: artistId } });
    if (!artist) throw new AppException(ErrorCode.ARTIST_NOT_FOUND);

    if (value && !artist.isSelectedMaster) {
      const count = await this.artists.count({ where: { isSelectedMaster: true } });
      if (count >= SELECTED_MASTER_LIMIT) {
        throw new AppException(ErrorCode.SELECTED_MASTER_LIMIT_EXCEEDED, {
          details: { limit: SELECTED_MASTER_LIMIT, current: count },
        });
      }
    }

    artist.isSelectedMaster = value;
    const saved = await this.artists.save(artist);
    await this.cache.del(CacheKey.selectedMasters(), CacheKey.artistDetail(artistId));
    return saved;
  }

  async setTier(artistId: string, tier: ArtistTier): Promise<ArtistPage> {
    const result = await this.artists.update(artistId, { tier });
    if (!result.affected) throw new AppException(ErrorCode.ARTIST_NOT_FOUND);
    await this.cache.del(CacheKey.artistDetail(artistId));
    return this.getDetail(artistId);
  }

  /** 리뷰 등록/삭제 시 호출되는 집계 갱신 */
  async refreshRating(artistPageId: string, rating: number, reviewCount: number): Promise<void> {
    await this.artists.update(artistPageId, { rating: rating.toFixed(2), reviewCount });
    await this.cache.del(CacheKey.artistDetail(artistPageId));
  }

  static readonly SELECTED_MASTER_LIMIT = SELECTED_MASTER_LIMIT;
  static readonly ADMIN_ROLE = UserRole.ADMIN;
}
