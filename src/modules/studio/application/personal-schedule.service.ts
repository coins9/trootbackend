import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { AppException } from '../../../shared/exceptions/app.exception';
import { ErrorCode } from '../../../shared/exceptions/error-code';
import { ArtistPage } from '../../artist/domain/artist.entity';
import { ArtistPersonalEvent } from '../domain/artist-personal-event.entity';

@Injectable()
export class PersonalScheduleService {
  constructor(
    @InjectRepository(ArtistPersonalEvent)
    private readonly repo: Repository<ArtistPersonalEvent>,
    @InjectRepository(ArtistPage)
    private readonly artistPageRepo: Repository<ArtistPage>,
  ) {}

  private async getArtistPageId(userId: string): Promise<string> {
    const page = await this.artistPageRepo.findOne({
      where: { userId, deletedAt: IsNull() },
      select: { id: true },
    });
    if (!page) throw new AppException(ErrorCode.ARTIST_NOT_FOUND);
    return page.id;
  }

  async list(userId: string, from: string, to: string) {
    const artistPageId = await this.getArtistPageId(userId);
    const events = await this.repo
      .createQueryBuilder('e')
      .where('e.artistPageId = :artistPageId', { artistPageId })
      .andWhere('e.date >= :from', { from })
      .andWhere('e.date <= :to', { to })
      .andWhere('e.deletedAt IS NULL')
      .orderBy('e.date', 'ASC')
      .addOrderBy('e.startHour', 'ASC')
      .getMany();
    return events.map((e) => this.mapEvent(e));
  }

  async listByArtistPageIds(artistPageIds: string[], date: string) {
    if (artistPageIds.length === 0) return [];
    return this.repo.find({
      where: { artistPageId: In(artistPageIds), date, deletedAt: IsNull() },
      order: { startHour: 'ASC' },
    });
  }

  async listByArtistPageIdsRange(artistPageIds: string[], from: string, to: string) {
    if (artistPageIds.length === 0) return [];
    return this.repo
      .createQueryBuilder('e')
      .where('e.artistPageId IN (:...ids)', { ids: artistPageIds })
      .andWhere('e.date >= :from', { from })
      .andWhere('e.date <= :to', { to })
      .andWhere('e.deletedAt IS NULL')
      .orderBy('e.date', 'ASC')
      .addOrderBy('e.startHour', 'ASC')
      .getMany();
  }

  async create(userId: string, dto: Partial<ArtistPersonalEvent>) {
    const artistPageId = await this.getArtistPageId(userId);
    const event = this.repo.create({ ...dto, artistPageId });
    await this.repo.save(event);
    return this.mapEvent(event);
  }

  async update(id: string, userId: string, dto: Partial<ArtistPersonalEvent>) {
    const event = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!event) throw new AppException(ErrorCode.NOT_FOUND);

    const artistPageId = await this.getArtistPageId(userId);
    if (event.artistPageId !== artistPageId) throw new AppException(ErrorCode.FORBIDDEN);

    Object.assign(event, dto);
    await this.repo.save(event);
    return this.mapEvent(event);
  }

  async remove(id: string, userId: string) {
    const event = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!event) throw new AppException(ErrorCode.NOT_FOUND);

    const artistPageId = await this.getArtistPageId(userId);
    if (event.artistPageId !== artistPageId) throw new AppException(ErrorCode.FORBIDDEN);

    event.deletedAt = new Date();
    await this.repo.save(event);
    return { ok: true };
  }

  private mapEvent(e: ArtistPersonalEvent) {
    return {
      id: e.id,
      artistPageId: e.artistPageId,
      date: e.date,
      startHour: e.startHour,
      durationH: e.durationH,
      title: e.title,
      subtitle: e.subtitle,
      kind: e.kind,
      status: e.status,
      customerName: e.customerName,
      bodyPart: e.bodyPart,
      memo: e.memo,
      depositStatus: e.depositStatus,
      depositAmount: e.depositAmount,
      createdAt: e.createdAt.toISOString(),
    };
  }
}
