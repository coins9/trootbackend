import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { CurrentUser, Public } from '../../../shared/auth/guards';
import { AdService } from '../application/ad.service';
import { AdPlacement, AdType } from '../domain/campaign.entity';

class PurchaseDto {
  @IsEnum(AdPlacement) placement: AdPlacement;
  @IsEnum(AdType) type: AdType;
  @IsString() @Length(1, 20) productCode: string;
  @IsOptional() @IsUUID() targetId?: string;
  /** 노출 세그먼트 — 카드광고는 지역 필수 */
  @IsOptional() @IsString() @Length(1, 50) regionKey?: string;
  @IsOptional() @IsString() @Length(1, 50) genreKey?: string;
}

class SuperUpDto {
  @IsUUID() campaignId: string;
  @IsUUID() targetId: string;
}

class ServingQuery {
  @IsEnum(AdPlacement) placement: AdPlacement;
  @IsEnum(AdType) type: AdType;
  @IsOptional() @IsString() @Length(1, 50) regionKey?: string;
  @IsOptional() @IsString() @Length(1, 50) genreKey?: string;
}

class ServingArtworksQuery {
  @IsOptional() @IsString() @Length(1, 50) regionKey?: string;
  @IsOptional() @IsString() @Length(1, 50) genreKey?: string;
}

class AvailabilityQuery {
  @IsEnum(AdPlacement) placement: AdPlacement;
  @IsString() @Length(1, 50) regionKey: string;
  @IsOptional() @IsString() @Length(1, 50) genreKey?: string;
}

@Controller('app/ads')
export class AppAdController {
  constructor(private readonly adService: AdService) {}

  @Public()
  @Get('products')
  products() {
    return this.adService.getProducts();
  }

  /** 목록/피드가 현재 면·지역·장르에 맞는 광고를 받아간다 (라운드로빈 + 강제순위) */
  @Public()
  @Get('serving')
  serving(@Query() q: ServingQuery) {
    return this.adService.getServingAds(q.placement, q.type, {
      regionKey: q.regionKey,
      genreKey: q.genreKey,
    });
  }

  /** 홈 피드에 끼워 넣을 작품 광고(카드광고 + 슈퍼UP + 배너) — 대상 작품 정보 포함 */
  @Public()
  @Get('serving/artworks')
  servingArtworks(@Query() q: ServingArtworksQuery) {
    return this.adService.getActiveArtworkAds({
      regionKey: q.regionKey,
      genreKey: q.genreKey,
    });
  }

  /** 광고 구매 화면 — 세그먼트 잔여 슬롯 표시 */
  @Get('availability')
  availability(@Query() q: AvailabilityQuery) {
    return this.adService.segmentAvailability(q.placement, {
      regionKey: q.regionKey,
      genreKey: q.genreKey,
    });
  }

  @Get('me')
  mine(@CurrentUser('id') userId: string) {
    return this.adService.listMine(userId);
  }

  @Get('me/stats')
  stats(@CurrentUser('id') userId: string) {
    return this.adService.stats(userId);
  }

  /**
   * 광고 구매 신청 — PENDING 캠페인 생성.
   * 이후 PG 결제 완료 후 /:id/activate 를 호출해야 광고가 시작된다.
   */
  @Post('purchase')
  purchase(@CurrentUser('id') userId: string, @Body() dto: PurchaseDto) {
    return this.adService.purchase({
      ownerUserId: userId,
      placement: dto.placement,
      type: dto.type,
      productCode: dto.productCode,
      targetId: dto.targetId,
      segment: { regionKey: dto.regionKey, genreKey: dto.genreKey },
    });
  }

  /**
   * 광고 활성화 — 결제 확인 후 PENDING → ACTIVE 전환.
   * PG 연동 전 테스트 환경에서는 purchase() 직후 클라이언트가 즉시 호출한다.
   */
  @Post(':id/activate')
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.adService.activateCampaign(id, userId);
  }

  @Post('super-up')
  superUp(@CurrentUser('id') userId: string, @Body() dto: SuperUpDto) {
    return this.adService.useSuperUp(userId, dto.campaignId, dto.targetId);
  }

  /** 노출 집계 — ACTIVE 캠페인만 카운트됨 */
  @Public()
  @Post(':id/impression')
  async impression(@Param('id', ParseUUIDPipe) id: string) {
    void this.adService.trackImpression(id);
    return { tracked: true };
  }

  /** 클릭 집계 — ACTIVE 캠페인만 카운트됨 */
  @Public()
  @Post(':id/click')
  async click(@Param('id', ParseUUIDPipe) id: string) {
    void this.adService.trackClick(id);
    return { tracked: true };
  }

  /**
   * 문의 집계 — 광고를 통해 상세 화면의 문의하기/예약하기 버튼을 눌렀을 때 호출.
   * ACTIVE 캠페인만 카운트됨.
   */
  @Public()
  @Post(':id/inquiry')
  async inquiry(@Param('id', ParseUUIDPipe) id: string) {
    void this.adService.trackInquiry(id);
    return { tracked: true };
  }
}
