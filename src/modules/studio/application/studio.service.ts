import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { Between, In, IsNull, Not, Repository } from 'typeorm';
import { AppException } from '../../../shared/exceptions/app.exception';
import { ErrorCode } from '../../../shared/exceptions/error-code';
import { ArtistPage } from '../../artist/domain/artist.entity';
import { Reservation } from '../../reservation/domain/reservation.entity';
import { User } from '../../user/domain/user.entity';
import { Studio } from '../domain/studio.entity';
import { StudioMember, StudioRole } from '../domain/studio-member.entity';

const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_CODE_TTL_DAYS = 7;

function generateInviteCode(): string {
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => INVITE_CODE_CHARS[b % INVITE_CODE_CHARS.length]).join('');
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

@Injectable()
export class StudioService {
  constructor(
    @InjectRepository(Studio) private readonly studioRepo: Repository<Studio>,
    @InjectRepository(StudioMember) private readonly memberRepo: Repository<StudioMember>,
    @InjectRepository(ArtistPage) private readonly artistPageRepo: Repository<ArtistPage>,
    @InjectRepository(Reservation) private readonly reservationRepo: Repository<Reservation>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  // ── helpers ──────────────────────────────────────────────

  private mapStudio(s: Studio) {
    return {
      id: s.id,
      name: s.name,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      ownerId: s.ownerId,
      inviteCode: s.inviteCode,
      inviteCodeExpiresAt: s.inviteCodeExpiresAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
    };
  }

  private mapMember(m: StudioMember) {
    return {
      id: m.id,
      userId: m.userId,
      studioId: m.studioId,
      role: m.role,
      bedName: m.bedName,
      nickname: m.user?.nickname ?? '(미등록)',
      profileImage: m.user?.profileImage ?? null,
      joinedAt: m.joinedAt.toISOString(),
    };
  }

  private async requireActiveMember(studioId: string, userId: string): Promise<StudioMember> {
    const member = await this.memberRepo.findOne({
      where: { studioId, userId, deletedAt: IsNull() },
    });
    if (!member || member.role === StudioRole.PENDING) {
      throw new AppException(ErrorCode.STUDIO_FORBIDDEN);
    }
    return member;
  }

  // ── endpoints ─────────────────────────────────────────────

  async mine(userId: string) {
    const member = await this.memberRepo.findOne({
      where: { userId, role: Not(StudioRole.PENDING), deletedAt: IsNull() },
    });
    if (!member) return null;

    const studio = await this.studioRepo.findOne({
      where: { id: member.studioId, deletedAt: IsNull() },
    });
    if (!studio) return null;

    return this.mapStudio(studio);
  }

  async register(userId: string, dto: { name: string; address: string; lat?: number; lng?: number }) {
    const existing = await this.memberRepo.findOne({
      where: { userId, role: Not(StudioRole.PENDING), deletedAt: IsNull() },
    });
    if (existing) throw new AppException(ErrorCode.STUDIO_ALREADY_EXISTS);

    const inviteCode = generateInviteCode();
    const now = new Date();

    const studio = this.studioRepo.create({
      name: dto.name,
      address: dto.address,
      lat: dto.lat ?? null,
      lng: dto.lng ?? null,
      ownerId: userId,
      inviteCode,
      inviteCodeExpiresAt: addDays(now, INVITE_CODE_TTL_DAYS),
    });
    await this.studioRepo.save(studio);

    const member = this.memberRepo.create({
      studioId: studio.id,
      userId,
      role: StudioRole.OWNER,
      bedName: null,
      joinedAt: now,
    });
    await this.memberRepo.save(member);

    return this.mapStudio(studio);
  }

  async join(userId: string, code: string) {
    const studio = await this.studioRepo.findOne({
      where: { inviteCode: code, deletedAt: IsNull() },
    });

    if (!studio) throw new AppException(ErrorCode.STUDIO_INVITE_CODE_INVALID);

    if (studio.inviteCodeExpiresAt && studio.inviteCodeExpiresAt < new Date()) {
      throw new AppException(ErrorCode.STUDIO_INVITE_CODE_EXPIRED);
    }

    const existing = await this.memberRepo.findOne({
      where: { studioId: studio.id, userId, deletedAt: IsNull() },
    });
    if (existing && existing.role !== StudioRole.PENDING) {
      throw new AppException(ErrorCode.STUDIO_ALREADY_MEMBER);
    }

    const now = new Date();
    let member: StudioMember;

    if (existing) {
      existing.role = StudioRole.ARTIST;
      existing.joinedAt = now;
      member = await this.memberRepo.save(existing);
    } else {
      member = await this.memberRepo.save(
        this.memberRepo.create({
          studioId: studio.id,
          userId,
          role: StudioRole.ARTIST,
          bedName: null,
          joinedAt: now,
        }),
      );
    }

    return { studio: this.mapStudio(studio), member: this.mapMember(member) };
  }

  async members(studioId: string, requesterId: string) {
    await this.requireActiveMember(studioId, requesterId);

    const members = await this.memberRepo.find({
      where: { studioId, deletedAt: IsNull() },
      relations: { user: true },
      order: { joinedAt: 'ASC' },
    });

    return members.map((m) => this.mapMember(m));
  }

  async refreshCode(studioId: string, requesterId: string) {
    const member = await this.memberRepo.findOne({
      where: { studioId, userId: requesterId, deletedAt: IsNull() },
    });
    if (!member || member.role !== StudioRole.OWNER) {
      throw new AppException(ErrorCode.STUDIO_FORBIDDEN);
    }

    const studio = await this.studioRepo.findOneOrFail({ where: { id: studioId } });
    studio.inviteCode = generateInviteCode();
    studio.inviteCodeExpiresAt = addDays(new Date(), INVITE_CODE_TTL_DAYS);
    await this.studioRepo.save(studio);

    return {
      inviteCode: studio.inviteCode,
      inviteCodeExpiresAt: studio.inviteCodeExpiresAt.toISOString(),
    };
  }

  async schedule(studioId: string, requesterId: string, date: string) {
    await this.requireActiveMember(studioId, requesterId);

    const members = await this.memberRepo.find({
      where: { studioId, role: Not(StudioRole.PENDING), deletedAt: IsNull() },
      relations: { user: true },
      order: { joinedAt: 'ASC' },
    });

    if (members.length === 0) return [];

    const userIds = members.map((m) => m.userId);

    const artistPages = await this.artistPageRepo.find({
      where: { userId: In(userIds), deletedAt: IsNull() },
    });
    const pageByUserId = new Map(artistPages.map((ap) => [ap.userId, ap]));

    const artistPageIds = artistPages.map((ap) => ap.id);

    // KST(UTC+9) 기준 하루 범위
    const dayStart = new Date(`${date}T00:00:00+09:00`);
    const dayEnd = new Date(`${date}T23:59:59+09:00`);

    const reservations =
      artistPageIds.length > 0
        ? await this.reservationRepo.find({
            where: {
              artistPageId: In(artistPageIds),
              scheduledAt: Between(dayStart, dayEnd),
              deletedAt: IsNull(),
            },
            order: { scheduledAt: 'ASC' },
          })
        : [];

    // 고객명 조회
    const customerIds = [...new Set(reservations.map((r) => r.customerId))];
    const customers =
      customerIds.length > 0
        ? await this.userRepo.find({ where: { id: In(customerIds) } })
        : [];
    const customerById = new Map(customers.map((u) => [u.id, u]));

    const rsvByPageId = new Map<string, typeof reservations>();
    for (const r of reservations) {
      const arr = rsvByPageId.get(r.artistPageId) ?? [];
      arr.push(r);
      rsvByPageId.set(r.artistPageId, arr);
    }

    return members.map((m) => {
      const page = pageByUserId.get(m.userId);
      const rsvList = page ? (rsvByPageId.get(page.id) ?? []) : [];
      return {
        memberId: m.id,
        nickname: m.user?.nickname ?? '(미등록)',
        bedName: m.bedName,
        reservations: rsvList.map((r) => ({
          id: r.id,
          scheduledAt: r.scheduledAt.toISOString(),
          durationMinutes: r.durationMinutes,
          bodyPart: r.bodyPart,
          customerName: customerById.get(r.customerId)?.nickname ?? null,
          status: r.status,
          memo: r.memo,
        })),
      };
    });
  }
}
