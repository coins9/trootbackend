import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { AppException } from '../../../shared/exceptions/app.exception';
import { ErrorCode } from '../../../shared/exceptions/error-code';
import { buildCursorPage } from '../../../shared/http/pagination.dto';
import { ArtistService } from '../../artist/application/artist.service';
import { User } from '../../user/domain/user.entity';
import { ArtistPage } from '../../artist/domain/artist.entity';
import { Artwork } from '../../artist/domain/artwork.entity';
import {
  DepositStatus, Reservation, ReservationStatus,
} from '../domain/reservation.entity';

/** 타투이스트 예약함에 내려주는 뷰 — 누가 무엇을 언제 요청했는지 */
export interface ArtistReservationView {
  id: string;
  status: ReservationStatus;
  scheduledAt: string;
  durationMinutes: number;
  bodyPart: string | null;
  sizePreset: string | null;
  memo: string | null;
  referenceImages: string[];
  estimatedPriceKrw: number | null;
  depositKrw: number;
  depositStatus: DepositStatus;
  artworkId: string | null;
  artworkTitle: string | null;
  createdAt: string;
  customer: { id: string; nickname: string | null; profileImage: string | null } | null;
}

export interface CreateReservationCommand {
  customerId: string;
  artistPageId: string;
  artworkId?: string;
  scheduledAt: string;
  durationMinutes?: number;
  bodyPart?: string;
  sizePreset?: string;
  memo?: string;
  referenceImages?: string[];
}

/** 고객 예약 목록에 내려주는 뷰 — 어떤 타투이스트에게/언제/무슨 시술인지 */
export interface CustomerReservationView {
  id: string;
  status: ReservationStatus;
  scheduledAt: string;
  durationMinutes: number;
  bodyPart: string | null;
  sizePreset: string | null;
  artworkTitle: string | null;
  depositKrw: number;
  depositStatus: DepositStatus;
  estimatedPriceKrw: number | null;
  createdAt: string;
  artist: {
    id: string;
    pageName: string;
    profileImage: string | null;
    regionSido: string | null;
    regionSigungu: string | null;
    openChatUrl: string | null;
  } | null;
}

/** 상태 전이 규칙 — 허용되지 않은 전이는 서비스에서 차단한다 */
const ALLOWED_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  [ReservationStatus.REQUESTED]: [ReservationStatus.CONFIRMED, ReservationStatus.CANCELLED],
  [ReservationStatus.CONFIRMED]: [
    ReservationStatus.DEPOSIT_PAID, ReservationStatus.COMPLETED,
    ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW,
  ],
  [ReservationStatus.DEPOSIT_PAID]: [
    ReservationStatus.COMPLETED, ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW,
  ],
  [ReservationStatus.COMPLETED]: [],
  [ReservationStatus.CANCELLED]: [],
  [ReservationStatus.NO_SHOW]: [],
};

@Injectable()
export class ReservationService {
  constructor(
    @InjectRepository(Reservation) private readonly reservations: Repository<Reservation>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(ArtistPage) private readonly artists: Repository<ArtistPage>,
    @InjectRepository(Artwork) private readonly artworks: Repository<Artwork>,
    private readonly artistService: ArtistService,
  ) {}

  async create(command: CreateReservationCommand): Promise<Reservation> {
    // 존재하지 않는 타투이스트로 예약이 생기지 않도록 먼저 검증
    await this.artistService.getDetail(command.artistPageId);

    return this.reservations.save(
      this.reservations.create({
        ...command,
        scheduledAt: new Date(command.scheduledAt),
        status: ReservationStatus.REQUESTED,
      }),
    );
  }

  /** 고객 목록 (타투이스트 정보 조인) */
  async listForCustomer(customerId: string, cursor: string | undefined, limit: number) {
    const qb = this.reservations
      .createQueryBuilder('r')
      .where('r.customerId = :customerId', { customerId })
      .orderBy('r.scheduledAt', 'DESC')
      .take(limit + 1);

    if (cursor) qb.andWhere('r.scheduledAt < :cursor', { cursor: new Date(cursor) });

    const rows = await qb.getMany();

    const artistIds = [...new Set(rows.map((r) => r.artistPageId))];
    const artists = artistIds.length
      ? await this.artists.find({ where: { id: In(artistIds) } })
      : [];
    const artistMap = new Map(artists.map((a) => [a.id, a]));

    const artworkIds = [...new Set(rows.map((r) => r.artworkId).filter(Boolean))] as string[];
    const artworksData = artworkIds.length
      ? await this.artworks.find({ where: { id: In(artworkIds) }, select: { id: true, title: true } })
      : [];
    const artworkMap = new Map(artworksData.map((a) => [a.id, a]));

    const views: CustomerReservationView[] = rows.map((r) => ({
      id: r.id,
      status: r.status,
      scheduledAt: r.scheduledAt.toISOString(),
      durationMinutes: r.durationMinutes,
      bodyPart: r.bodyPart,
      sizePreset: r.sizePreset,
      artworkTitle: r.artworkId ? (artworkMap.get(r.artworkId)?.title ?? null) : null,
      depositKrw: r.depositKrw,
      depositStatus: r.depositStatus,
      estimatedPriceKrw: r.estimatedPriceKrw,
      createdAt: r.createdAt.toISOString(),
      artist: artistMap.has(r.artistPageId)
        ? {
            id: r.artistPageId,
            pageName: artistMap.get(r.artistPageId)!.pageName,
            profileImage: artistMap.get(r.artistPageId)!.profileImage,
            regionSido: artistMap.get(r.artistPageId)!.regionSido,
            regionSigungu: artistMap.get(r.artistPageId)!.regionSigungu,
            openChatUrl: artistMap.get(r.artistPageId)!.openChatUrl,
          }
        : null,
    }));

    return buildCursorPage(views, limit, (v) => v.scheduledAt);
  }

  /** 타투이스트 예약 목록 (상태/예약금 상태 필터) */
  async listForArtist(
    userId: string,
    status: ReservationStatus | undefined,
    depositStatus: DepositStatus | undefined,
    cursor: string | undefined,
    limit: number,
  ) {
    const artist = await this.artistService.getByUserId(userId);
    const qb = this.reservations
      .createQueryBuilder('r')
      .where('r.artistPageId = :artistPageId', { artistPageId: artist.id })
      .orderBy('r.scheduledAt', 'DESC')
      .take(limit + 1);

    if (status) qb.andWhere('r.status = :status', { status });
    if (depositStatus) qb.andWhere('r.depositStatus = :depositStatus', { depositStatus });
    if (cursor) qb.andWhere('r.scheduledAt < :cursor', { cursor: new Date(cursor) });

    const rows = await qb.getMany();

    // 고객(요청자) 정보 조인 — 한 번의 조회로 매핑
    const customerIds = [...new Set(rows.map((r) => r.customerId))];
    const users = customerIds.length
      ? await this.users.find({ where: { id: In(customerIds) } })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const artworkIds = [...new Set(rows.map((r) => r.artworkId).filter(Boolean))] as string[];
    const artworksData = artworkIds.length
      ? await this.artworks.find({ where: { id: In(artworkIds) }, select: { id: true, title: true } })
      : [];
    const artworkMap = new Map(artworksData.map((a) => [a.id, a]));

    const views: ArtistReservationView[] = rows.map((r) => ({
      id: r.id,
      status: r.status,
      scheduledAt: r.scheduledAt.toISOString(),
      durationMinutes: r.durationMinutes,
      bodyPart: r.bodyPart,
      sizePreset: r.sizePreset,
      memo: r.memo,
      referenceImages: r.referenceImages,
      estimatedPriceKrw: r.estimatedPriceKrw,
      depositKrw: r.depositKrw,
      depositStatus: r.depositStatus,
      artworkId: r.artworkId,
      artworkTitle: r.artworkId ? (artworkMap.get(r.artworkId)?.title ?? null) : null,
      createdAt: r.createdAt.toISOString(),
      customer: userMap.has(r.customerId)
        ? {
            id: r.customerId,
            nickname: userMap.get(r.customerId)!.nickname,
            profileImage: userMap.get(r.customerId)!.profileImage,
          }
        : null,
    }));

    return buildCursorPage(views, limit, (v) => v.scheduledAt);
  }

  /** 캘린더 — 월 단위 조회 (고객명 포함) */
  async schedule(userId: string, from: string, to: string): Promise<(Reservation & { customerName: string | null })[]> {
    const artist = await this.artistService.getByUserId(userId);
    const rows = await this.reservations.find({
      where: {
        artistPageId: artist.id,
        scheduledAt: Between(new Date(from), new Date(to)),
      },
      order: { scheduledAt: 'ASC' },
    });
    const customerIds = [...new Set(rows.map((r) => r.customerId))];
    const users = customerIds.length
      ? await this.users.find({ where: { id: In(customerIds) }, select: { id: true, nickname: true } })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u.nickname]));
    return rows.map((r) => Object.assign(r, { customerName: userMap.get(r.customerId) ?? null }));
  }

  async getDetail(id: string, requesterId: string): Promise<Reservation> {
    const reservation = await this.reservations.findOne({ where: { id } });
    if (!reservation) throw new AppException(ErrorCode.NOT_FOUND, { details: { id } });

    // 당사자만 열람 가능 — 타인의 예약 정보 노출 방지
    if (reservation.customerId !== requesterId) {
      const artist = await this.artistService
        .getByUserId(requesterId)
        .catch(() => null);
      if (!artist || artist.id !== reservation.artistPageId) {
        throw new AppException(ErrorCode.FORBIDDEN);
      }
    }
    return reservation;
  }

  async changeStatus(
    id: string,
    next: ReservationStatus,
    actorId: string,
    reason?: string,
  ): Promise<Reservation> {
    const reservation = await this.getDetail(id, actorId);

    if (!ALLOWED_TRANSITIONS[reservation.status].includes(next)) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: { from: reservation.status, to: next },
      });
    }

    reservation.status = next;
    if (next === ReservationStatus.CANCELLED) {
      reservation.cancelReason = reason ?? null;
      reservation.cancelledAt = new Date();
    }
    return this.reservations.save(reservation);
  }

  /** 예약금 요청 — 타투이스트가 금액을 지정 */
  async requestDeposit(id: string, userId: string, amountKrw: number): Promise<Reservation> {
    const artist = await this.artistService.getByUserId(userId);
    const reservation = await this.reservations.findOne({
      where: { id, artistPageId: artist.id },
    });
    if (!reservation) throw new AppException(ErrorCode.NOT_FOUND, { details: { id } });

    reservation.depositKrw = amountKrw;
    reservation.depositStatus = DepositStatus.PENDING;
    return this.reservations.save(reservation);
  }

  /** 입금 확인 — 실제 PG 연동 전까지는 타투이스트가 수동 확인 */
  async confirmDeposit(id: string, userId: string): Promise<Reservation> {
    const artist = await this.artistService.getByUserId(userId);
    const reservation = await this.reservations.findOne({
      where: { id, artistPageId: artist.id },
    });
    if (!reservation) throw new AppException(ErrorCode.NOT_FOUND, { details: { id } });

    reservation.depositStatus = DepositStatus.PAID;
    reservation.depositPaidAt = new Date();
    if (reservation.status === ReservationStatus.CONFIRMED) {
      reservation.status = ReservationStatus.DEPOSIT_PAID;
    }
    return this.reservations.save(reservation);
  }

  /** 예약금 관리 화면 집계 */
  async depositSummary(userId: string) {
    const artist = await this.artistService.getByUserId(userId);

    // 건별 조회 대신 DB 집계로 처리해 전송량과 계산 비용을 줄인다
    const rows = await this.reservations
      .createQueryBuilder('r')
      .select('r.depositStatus', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .addSelect('COALESCE(SUM(r.depositKrw), 0)::int', 'sum')
      .where('r.artistPageId = :artistPageId', { artistPageId: artist.id })
      .andWhere('r.depositStatus != :none', { none: DepositStatus.NONE })
      .groupBy('r.depositStatus')
      .getRawMany<{ status: DepositStatus; count: number; sum: number }>();

    const find = (s: DepositStatus) => rows.find((r) => r.status === s);
    return {
      pending: { count: find(DepositStatus.PENDING)?.count ?? 0, sum: find(DepositStatus.PENDING)?.sum ?? 0 },
      paid: { count: find(DepositStatus.PAID)?.count ?? 0, sum: find(DepositStatus.PAID)?.sum ?? 0 },
      refunded: { count: find(DepositStatus.REFUNDED)?.count ?? 0, sum: find(DepositStatus.REFUNDED)?.sum ?? 0 },
    };
  }

  /** 리뷰 작성 가능한 예약 — 확정(confirmed) 또는 완료(completed) 후 14일 이내 */
  async listReviewable(customerId: string) {
    const since = new Date(Date.now() - 14 * 86_400_000);
    const rows = await this.reservations.find({
      where: {
        customerId,
        status: In([ReservationStatus.CONFIRMED, ReservationStatus.COMPLETED]),
        updatedAt: Between(since, new Date()),
      },
      order: { updatedAt: 'DESC' },
    });

    // 작가 요약 조인 — 리뷰 작성 카드에 작가 정보 표시
    const artistIds = [...new Set(rows.map((r) => r.artistPageId))];
    const artists = artistIds.length
      ? await this.artists.find({ where: { id: In(artistIds) } })
      : [];
    const artistMap = new Map(artists.map((a) => [a.id, a]));

    return rows.map((r) => {
      const a = artistMap.get(r.artistPageId);
      return {
        id: r.id,
        artistPageId: r.artistPageId,
        artworkId: r.artworkId,
        scheduledAt: r.scheduledAt.toISOString(),
        bodyPart: r.bodyPart,
        sizePreset: r.sizePreset,
        updatedAt: r.updatedAt.toISOString(),
        artist: a
          ? {
              id: a.id,
              pageName: a.pageName,
              profileImage: a.profileImage,
              regionSido: a.regionSido,
              regionSigungu: a.regionSigungu,
            }
          : null,
      };
    });
  }
}
