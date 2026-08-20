import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, Repository } from 'typeorm';
import { CacheService } from '../../../shared/cache/cache.service';
import { AppException } from '../../../shared/exceptions/app.exception';
import { ErrorCode } from '../../../shared/exceptions/error-code';
import type { OffsetPage, OffsetPaginationQuery } from '../../../shared/http/pagination.dto';
import { Artwork, ArtworkStatus } from '../../artist/domain/artwork.entity';
import {
  AD_PRODUCTS, AdCampaign, AdPlacement, AdType, CampaignStatus,
} from '../domain/campaign.entity';

/**
 * 카드광고 세그먼트당 동시 노출 슬롯 수.
 * 전국 단일이 아니라 (면 × 지역 × 장르) 세그먼트마다 이 수만큼 팔린다.
 * → 인벤토리 = 8 × 면수 × 지역수 × 장르수. 플랫폼이 커질수록 슬롯도 늘어난다.
 */
const CARD_AD_SLOT_PER_SEGMENT = 8;

export interface AdSegment {
  regionKey?: string | null;
  genreKey?: string | null;
}

export interface PurchaseCommand {
  ownerUserId: string;
  placement: AdPlacement;
  type: AdType;
  productCode: string;
  targetId?: string;
  segment: AdSegment;
}

@Injectable()
export class AdService {
  constructor(
    @InjectRepository(AdCampaign) private readonly campaigns: Repository<AdCampaign>,
    @InjectRepository(Artwork) private readonly artworks: Repository<Artwork>,
    private readonly cache: CacheService,
  ) {}

  getProducts() {
    return AD_PRODUCTS;
  }

  /** 구매 — PG 연동 전이므로 결제 성공을 가정하고 캠페인만 생성한다 */
  async purchase(cmd: PurchaseCommand): Promise<AdCampaign> {
    const products = AD_PRODUCTS[cmd.type as keyof typeof AD_PRODUCTS];
    if (!products) throw new AppException(ErrorCode.VALIDATION_FAILED, { details: { type: cmd.type } });

    const product = products.find((p) => p.code === cmd.productCode);
    if (!product) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, { details: { productCode: cmd.productCode } });
    }

    // 카드광고는 반드시 지역 세그먼트를 지정해야 한다 (전국 슬롯 남발 방지)
    if (cmd.type === AdType.CARD_AD && !cmd.segment.regionKey) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, { details: { reason: 'region_required' } });
    }

    // 슬롯 카운트는 (면 + 세그먼트) 안에서만 — 다른 지역/면은 영향 없음
    if (cmd.type === AdType.CARD_AD) {
      const running = await this.campaigns.count({
        where: {
          placement: cmd.placement,
          type: AdType.CARD_AD,
          status: CampaignStatus.ACTIVE,
          regionKey: cmd.segment.regionKey!,
          genreKey: cmd.segment.genreKey ?? IsNull(),
        },
      });
      if (running >= CARD_AD_SLOT_PER_SEGMENT) {
        throw new AppException(ErrorCode.AD_SLOT_SOLD_OUT, {
          details: {
            limit: CARD_AD_SLOT_PER_SEGMENT,
            placement: cmd.placement,
            regionKey: cmd.segment.regionKey,
            genreKey: cmd.segment.genreKey ?? null,
          },
        });
      }
    }

    const now = new Date();
    const days = 'days' in product ? product.days : 0;
    const quantity = 'quantity' in product ? product.quantity : 0;

    const campaign = await this.campaigns.save(
      this.campaigns.create({
        ownerUserId: cmd.ownerUserId,
        placement: cmd.placement,
        targetId: cmd.targetId ?? null,
        type: cmd.type,
        regionKey: cmd.segment.regionKey ?? null,
        genreKey: cmd.segment.genreKey ?? null,
        productCode: product.code,
        planLabel: product.label,
        priceKrw: product.price,
        remainingCount: quantity,
        status: CampaignStatus.ACTIVE,
        startedAt: now,
        expiresAt: days ? new Date(now.getTime() + days * 86_400_000) : null,
      }),
    );

    // 작품 광고는 대상 작품에 '광고중' 표시를 켠다
    if (cmd.placement === AdPlacement.ARTWORK && cmd.targetId && cmd.type === AdType.CARD_AD) {
      await this.artworks.update(cmd.targetId, { isPromoted: true });
    }
    return campaign;
  }

  /** 슈퍼UP 사용 — 잔여 횟수를 차감하고 대상을 상단으로 끌어올린다 */
  async useSuperUp(userId: string, campaignId: string, targetId: string): Promise<AdCampaign> {
    const campaign = await this.campaigns.findOne({
      where: { id: campaignId, ownerUserId: userId, type: AdType.SUPER_UP },
    });
    if (!campaign) throw new AppException(ErrorCode.CAMPAIGN_NOT_FOUND);
    if (campaign.remainingCount <= 0) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, { details: { reason: 'no_remaining' } });
    }

    await this.campaigns.decrement({ id: campaignId }, 'remainingCount', 1);
    if (campaign.remainingCount - 1 === 0) {
      await this.campaigns.update(campaignId, { status: CampaignStatus.COMPLETED });
    }

    // 작품 면이면 작품을 끌어올린다 (다른 면은 대상 테이블의 bump 를 각 서비스가 처리)
    if (campaign.placement === AdPlacement.ARTWORK) {
      await this.artworks.update(targetId, { bumpedAt: new Date() });
    }
    campaign.targetId = targetId;
    return campaign;
  }

  /**
   * 세그먼트 노출 광고 반환.
   * adminPriority(강제 순위)를 최우선으로, 나머지는 라운드로빈 회전.
   */
  async getServingAds(
    placement: AdPlacement,
    type: AdType,
    segment: AdSegment,
    limit = 8,
  ): Promise<AdCampaign[]> {
    const qb = this.campaigns
      .createQueryBuilder('c')
      .where('c.placement = :placement', { placement })
      .andWhere('c.type = :type', { type })
      .andWhere('c.status = :status', { status: CampaignStatus.ACTIVE })
      .andWhere('(c.expiresAt IS NULL OR c.expiresAt > now())');

    if (segment.regionKey) {
      qb.andWhere('(c.regionKey = :region OR c.regionKey IS NULL)', { region: segment.regionKey });
    } else {
      qb.andWhere('c.regionKey IS NULL');
    }
    if (segment.genreKey) {
      qb.andWhere('(c.genreKey = :genre OR c.genreKey IS NULL)', { genre: segment.genreKey });
    }

    const all = await qb.getMany();

    // 관리자 강제 순위(pin)는 항상 최상단 고정
    const pinned = all.filter((c) => c.adminPriority > 0).sort((a, b) => b.adminPriority - a.adminPriority);
    const normal = all.filter((c) => c.adminPriority === 0)
      .sort((a, b) => (a.startedAt?.getTime() ?? 0) - (b.startedAt?.getTime() ?? 0));

    let ordered = normal;
    if (normal.length > 0) {
      // 라운드로빈: 세그먼트별 카운터로 시작 위치 회전
      const key = `ad:rr:${placement}:${type}:${segment.regionKey ?? 'all'}:${segment.genreKey ?? 'all'}`;
      const counter = (await this.cache.get<number>(key)) ?? 0;
      await this.cache.set(key, counter + 1, 60_000);
      const offset = counter % normal.length;
      ordered = [...normal.slice(offset), ...normal.slice(0, offset)];
    }

    return [...pinned, ...ordered].slice(0, limit);
  }

  async segmentAvailability(placement: AdPlacement, segment: AdSegment) {
    const used = await this.campaigns.count({
      where: {
        placement,
        type: AdType.CARD_AD,
        status: CampaignStatus.ACTIVE,
        regionKey: segment.regionKey ?? IsNull(),
        genreKey: segment.genreKey ?? IsNull(),
      },
    });
    return {
      used,
      total: CARD_AD_SLOT_PER_SEGMENT,
      available: Math.max(0, CARD_AD_SLOT_PER_SEGMENT - used),
    };
  }

  async listMine(userId: string): Promise<AdCampaign[]> {
    return this.campaigns.find({
      where: { ownerUserId: userId },
      order: { createdAt: 'DESC' },
    });
  }

  /** 광고 통계 — 소유자 대시보드 */
  async stats(userId: string) {
    const raw = await this.campaigns
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.impressions), 0)::int', 'impressions')
      .addSelect('COALESCE(SUM(c.clicks), 0)::int', 'clicks')
      .addSelect('COALESCE(SUM(c.priceKrw), 0)::int', 'spend')
      .addSelect('COUNT(*) FILTER (WHERE c.status = :active)::int', 'activeCount')
      .where('c.ownerUserId = :userId', { userId })
      .setParameter('active', CampaignStatus.ACTIVE)
      .getRawOne<Record<string, number>>();

    const impressions = Number(raw?.impressions ?? 0);
    const clicks = Number(raw?.clicks ?? 0);
    return {
      impressions,
      clicks,
      spend: Number(raw?.spend ?? 0),
      activeCount: Number(raw?.activeCount ?? 0),
      ctr: impressions ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
    };
  }

  /**
   * 홈 피드에 실제로 끼워 넣을 작품 광고 — 카드광고(고정 슬롯)와 슈퍼UP(랭킹 부스트) 캠페인을
   * 대상 작품 정보와 함께 반환한다. 캠페인만으로는 제목·이미지·가격이 없어 피드에 그릴 수 없다.
   */
  async getActiveArtworkAds(
    segment: AdSegment,
  ): Promise<{ campaignId: string; type: AdType; artwork: Artwork }[]> {
    const qb = this.campaigns
      .createQueryBuilder('c')
      .where('c.placement = :placement', { placement: AdPlacement.ARTWORK })
      .andWhere('c.type IN (:...types)', {
        types: [AdType.CARD_AD, AdType.SUPER_UP],
      })
      .andWhere('c.status = :status', { status: CampaignStatus.ACTIVE })
      .andWhere('(c.expiresAt IS NULL OR c.expiresAt > now())')
      .andWhere('c.targetId IS NOT NULL');

    if (segment.regionKey) {
      qb.andWhere('(c.regionKey = :region OR c.regionKey IS NULL)', {
        region: segment.regionKey,
      });
    } else {
      qb.andWhere('c.regionKey IS NULL');
    }
    if (segment.genreKey) {
      qb.andWhere('(c.genreKey = :genre OR c.genreKey IS NULL)', {
        genre: segment.genreKey,
      });
    }

    const campaigns = await qb.getMany();
    if (campaigns.length === 0) return [];

    const targetIds = [...new Set(campaigns.map((c) => c.targetId!))];
    const artworks = await this.artworks.find({
      where: { id: In(targetIds), status: ArtworkStatus.PUBLISHED },
      relations: { artist: true },
    });
    const artworkMap = new Map(artworks.map((a) => [a.id, a]));

    return campaigns
      .filter((c) => artworkMap.has(c.targetId!))
      .map((c) => ({
        campaignId: c.id,
        type: c.type,
        artwork: artworkMap.get(c.targetId!)!,
      }));
  }

  async trackImpression(campaignId: string): Promise<void> {
    await this.campaigns.increment({ id: campaignId }, 'impressions', 1);
  }

  async trackClick(campaignId: string): Promise<void> {
    await this.campaigns.increment({ id: campaignId }, 'clicks', 1);
  }

  /** 만료 캠페인 정리 — 스케줄러에서 호출 */
  async expireOutdated(): Promise<number> {
    const expired = await this.campaigns.find({
      where: { status: CampaignStatus.ACTIVE, expiresAt: LessThan(new Date()) },
      select: { id: true, targetId: true, placement: true },
    });
    if (expired.length === 0) return 0;

    await this.campaigns.update(expired.map((c) => c.id), { status: CampaignStatus.COMPLETED });

    const artworkIds = expired
      .filter((c) => c.placement === AdPlacement.ARTWORK && c.targetId)
      .map((c) => c.targetId as string);
    if (artworkIds.length > 0) {
      await this.artworks.update(artworkIds, { isPromoted: false });
    }
    return expired.length;
  }

  // ── 관리자 ────────────────────────────────────────────────

  async listForAdmin(
    query: OffsetPaginationQuery & { type?: AdType; status?: CampaignStatus; placement?: AdPlacement },
  ): Promise<OffsetPage<AdCampaign>> {
    const qb = this.campaigns
      .createQueryBuilder('c')
      .orderBy('c.createdAt', 'DESC')
      .skip((query.page - 1) * query.size)
      .take(query.size);

    if (query.type) qb.andWhere('c.type = :type', { type: query.type });
    if (query.status) qb.andWhere('c.status = :status', { status: query.status });
    if (query.placement) qb.andWhere('c.placement = :placement', { placement: query.placement });

    const [items, total] = await qb.getManyAndCount();
    return { items, page: query.page, size: query.size, total, totalPages: Math.ceil(total / query.size) };
  }

  async revenueSummary() {
    const raw = await this.campaigns
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.priceKrw), 0)::int', 'total')
      .addSelect('COUNT(*) FILTER (WHERE c.status = :active)::int', 'activeCount')
      .where('c.status != :refunded')
      .setParameter('active', CampaignStatus.ACTIVE)
      .setParameter('refunded', CampaignStatus.REFUNDED)
      .getRawOne<Record<string, number>>();

    return {
      totalRevenue: Number(raw?.total ?? 0),
      activeCount: Number(raw?.activeCount ?? 0),
    };
  }

  async refund(campaignId: string): Promise<AdCampaign> {
    const campaign = await this.campaigns.findOne({ where: { id: campaignId } });
    if (!campaign) throw new AppException(ErrorCode.CAMPAIGN_NOT_FOUND);

    campaign.status = CampaignStatus.REFUNDED;
    if (campaign.placement === AdPlacement.ARTWORK && campaign.targetId) {
      await this.artworks.update(campaign.targetId, { isPromoted: false });
    }
    return this.campaigns.save(campaign);
  }

  /** 관리자 강제 순위 — 특정 캠페인을 세그먼트 상단에 고정(또는 해제) */
  async setAdminPriority(campaignId: string, priority: number): Promise<AdCampaign> {
    const campaign = await this.campaigns.findOne({ where: { id: campaignId } });
    if (!campaign) throw new AppException(ErrorCode.CAMPAIGN_NOT_FOUND);

    campaign.adminPriority = Math.max(0, Math.floor(priority));
    return this.campaigns.save(campaign);
  }
}
