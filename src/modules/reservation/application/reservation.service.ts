import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { AppException } from '../../../shared/exceptions/app.exception';
import { ErrorCode } from '../../../shared/exceptions/error-code';
import { buildCursorPage } from '../../../shared/http/pagination.dto';
import { ArtistService } from '../../artist/application/artist.service';
import {
  DepositStatus, Reservation, ReservationStatus,
} from '../domain/reservation.entity';

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

  /** 고객 목록 */
  async listForCustomer(customerId: string, cursor: string | undefined, limit: number) {
    const qb = this.reservations
      .createQueryBuilder('r')
      .where('r.customerId = :customerId', { customerId })
      .orderBy('r.scheduledAt', 'DESC')
      .take(limit + 1);

    if (cursor) qb.andWhere('r.scheduledAt < :cursor', { cursor: new Date(cursor) });

    const rows = await qb.getMany();
    return buildCursorPage(rows, limit, (r) => r.scheduledAt.toISOString());
  }

  /** 타투이스트 예약 목록 (상태 필터) */
  async listForArtist(
    userId: string,
    status: ReservationStatus | undefined,
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
    if (cursor) qb.andWhere('r.scheduledAt < :cursor', { cursor: new Date(cursor) });

    const rows = await qb.getMany();
    return buildCursorPage(rows, limit, (r) => r.scheduledAt.toISOString());
  }

  /** 캘린더 — 월 단위 조회 */
  async schedule(userId: string, from: string, to: string): Promise<Reservation[]> {
    const artist = await this.artistService.getByUserId(userId);
    return this.reservations.find({
      where: {
        artistPageId: artist.id,
        scheduledAt: Between(new Date(from), new Date(to)),
      },
      order: { scheduledAt: 'ASC' },
    });
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

  /** 리뷰 작성 가능한 완료 예약 */
  async listReviewable(customerId: string): Promise<Reservation[]> {
    const since = new Date(Date.now() - 14 * 86_400_000);
    return this.reservations.find({
      where: {
        customerId,
        status: ReservationStatus.COMPLETED,
        updatedAt: Between(since, new Date()),
      },
      order: { updatedAt: 'DESC' },
    });
  }
}
