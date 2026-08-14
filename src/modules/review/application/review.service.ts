import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AppException } from '../../../shared/exceptions/app.exception';
import { ErrorCode } from '../../../shared/exceptions/error-code';
import { buildCursorPage } from '../../../shared/http/pagination.dto';
import { ArtistService } from '../../artist/application/artist.service';
import { ArtistPage } from '../../artist/domain/artist.entity';
import { Reservation, ReservationStatus } from '../../reservation/domain/reservation.entity';
import { User } from '../../user/domain/user.entity';
import { Review } from '../domain/review.entity';

/** 카드 렌더용 작가 요약 */
export interface ArtistMini {
  id: string;
  pageName: string;
  profileImage: string | null;
  regionSido: string | null;
  regionSigungu: string | null;
}

export interface CreateReviewCommand {
  authorId: string;
  reservationId: string;
  painScore: number;
  kindnessScore: number;
  hygieneScore: number;
  satisfactionScore: number;
  body: string;
  images?: string[];
}

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(Reservation) private readonly reservations: Repository<Reservation>,
    @InjectRepository(ArtistPage) private readonly artists: Repository<ArtistPage>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly artistService: ArtistService,
  ) {}

  /** 여러 작가의 요약 정보를 한 번에 조회 */
  private async loadArtistMinis(ids: string[]): Promise<Map<string, ArtistMini>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = await this.artists.find({ where: { id: In(unique) } });
    return new Map(
      rows.map((a) => [
        a.id,
        {
          id: a.id,
          pageName: a.pageName,
          profileImage: a.profileImage,
          regionSido: a.regionSido,
          regionSigungu: a.regionSigungu,
        },
      ]),
    );
  }

  /**
   * 리뷰 작성.
   * 실제 시술을 받은 사용자만 쓸 수 있도록 완료된 예약을 검증한다(기획서 요건).
   * 저장과 평점 재계산을 한 트랜잭션으로 묶어 집계가 어긋나지 않게 한다.
   */
  async create(command: CreateReviewCommand): Promise<Review> {
    const reservation = await this.reservations.findOne({
      where: { id: command.reservationId },
    });
    if (!reservation) throw new AppException(ErrorCode.NOT_FOUND, { details: { reservationId: command.reservationId } });
    if (reservation.customerId !== command.authorId) throw new AppException(ErrorCode.FORBIDDEN);
    if (reservation.status !== ReservationStatus.COMPLETED) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: { reason: 'reservation_not_completed' },
      });
    }

    const duplicated = await this.reviews.findOne({
      where: { reservationId: command.reservationId },
      select: { id: true },
    });
    if (duplicated) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, { details: { reason: 'already_reviewed' } });
    }

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Review);

      const average = Review.computeAverage(
        command.painScore, command.kindnessScore,
        command.hygieneScore, command.satisfactionScore,
      );

      const review = await repo.save(
        repo.create({
          reservationId: command.reservationId,
          authorId: command.authorId,
          artistPageId: reservation.artistPageId,
          painScore: command.painScore,
          kindnessScore: command.kindnessScore,
          hygieneScore: command.hygieneScore,
          satisfactionScore: command.satisfactionScore,
          averageScore: average.toFixed(2),
          body: command.body,
          images: command.images ?? [],
          bodyPart: reservation.bodyPart,
        }),
      );

      await this.recalculateRating(reservation.artistPageId, manager.getRepository(Review));
      return review;
    });
  }

  /** 타투이스트 평점 재계산 — 단일 집계 쿼리로 처리 */
  private async recalculateRating(artistPageId: string, repo: Repository<Review>): Promise<void> {
    const stat = await repo
      .createQueryBuilder('r')
      .select('COALESCE(AVG(r.averageScore), 0)', 'avg')
      .addSelect('COUNT(*)::int', 'count')
      .where('r.artistPageId = :artistPageId', { artistPageId })
      .andWhere('r.isHidden = false')
      .andWhere('r.deletedAt IS NULL')
      .getRawOne<{ avg: string; count: number }>();

    await this.artistService.refreshRating(
      artistPageId,
      Number(stat?.avg ?? 0),
      stat?.count ?? 0,
    );
  }

  async listByArtist(artistPageId: string, cursor: string | undefined, limit: number) {
    const qb = this.reviews
      .createQueryBuilder('r')
      .where('r.artistPageId = :artistPageId', { artistPageId })
      .andWhere('r.isHidden = false')
      .orderBy('r.createdAt', 'DESC')
      .take(limit + 1);

    if (cursor) qb.andWhere('r.createdAt < :cursor', { cursor: new Date(cursor) });

    const rows = await qb.getMany();
    const page = buildCursorPage(rows, limit, (r) => r.createdAt.toISOString());

    const authorIds = [...new Set(page.items.map((r) => r.authorId))];
    const customers = authorIds.length
      ? await this.users.find({ where: { id: In(authorIds) } })
      : [];
    const customerMap = new Map(customers.map((u) => [u.id, u]));

    const items = page.items.map((r) => ({
      ...r,
      customerNickname: customerMap.get(r.authorId)?.nickname ?? null,
    }));
    return { ...page, items };
  }

  async listMine(authorId: string, cursor: string | undefined, limit: number) {
    const qb = this.reviews
      .createQueryBuilder('r')
      .where('r.authorId = :authorId', { authorId })
      .orderBy('r.createdAt', 'DESC')
      .take(limit + 1);

    if (cursor) qb.andWhere('r.createdAt < :cursor', { cursor: new Date(cursor) });

    const rows = await qb.getMany();
    const page = buildCursorPage(rows, limit, (r) => r.createdAt.toISOString());

    const artistMap = await this.loadArtistMinis(page.items.map((r) => r.artistPageId));
    const items = page.items.map((r) => ({ ...r, artist: artistMap.get(r.artistPageId) ?? null }));
    return { ...page, items };
  }

  /** 항목별 평균 — 타투이스트 상세 상단에 노출 */
  async scoreSummary(artistPageId: string) {
    const raw = await this.reviews
      .createQueryBuilder('r')
      .select('COALESCE(AVG(r.painScore), 0)', 'pain')
      .addSelect('COALESCE(AVG(r.kindnessScore), 0)', 'kindness')
      .addSelect('COALESCE(AVG(r.hygieneScore), 0)', 'hygiene')
      .addSelect('COALESCE(AVG(r.satisfactionScore), 0)', 'satisfaction')
      .addSelect('COUNT(*)::int', 'count')
      .where('r.artistPageId = :artistPageId', { artistPageId })
      .andWhere('r.isHidden = false')
      .getRawOne<Record<string, string>>();

    const num = (v?: string) => Number(Number(v ?? 0).toFixed(2));
    return {
      pain: num(raw?.pain),
      kindness: num(raw?.kindness),
      hygiene: num(raw?.hygiene),
      satisfaction: num(raw?.satisfaction),
      count: Number(raw?.count ?? 0),
    };
  }

  /** 6개월 후 발색 사진 추가 */
  async addHealedImages(reviewId: string, authorId: string, images: string[]): Promise<Review> {
    const review = await this.reviews.findOne({ where: { id: reviewId, authorId } });
    if (!review) throw new AppException(ErrorCode.NOT_FOUND, { details: { reviewId } });

    review.healedImages = [...review.healedImages, ...images];
    return this.reviews.save(review);
  }

  /** 타투이스트 답글 — 본인 페이지의 리뷰에만 가능 */
  async reply(reviewId: string, userId: string, body: string): Promise<Review> {
    const artist = await this.artistService.getByUserId(userId);
    const review = await this.reviews.findOne({
      where: { id: reviewId, artistPageId: artist.id },
    });
    if (!review) throw new AppException(ErrorCode.NOT_FOUND, { details: { reviewId } });

    review.reply = body;
    review.repliedAt = new Date();
    return this.reviews.save(review);
  }
}
