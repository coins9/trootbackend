import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Roles } from '../../../shared/auth/guards';
import { OffsetPaginationQuery } from '../../../shared/http/pagination.dto';
import { UserRole } from '../../user/domain/user.entity';
import { AdService } from '../application/ad.service';
import { AdPlacement, AdType, CampaignStatus } from '../domain/campaign.entity';

class AdminAdQuery extends OffsetPaginationQuery {
  @IsOptional() @IsEnum(AdType) type?: AdType;
  @IsOptional() @IsEnum(CampaignStatus) status?: CampaignStatus;
  @IsOptional() @IsEnum(AdPlacement) placement?: AdPlacement;
}

class PriorityDto {
  /** 0 = 일반, 높을수록 상단 고정 */
  @Type(() => Number) @IsInt() @Min(0) @Max(100) priority: number;
}

@Controller('admin/ads')
@Roles(UserRole.ADMIN)
export class AdminAdController {
  constructor(private readonly adService: AdService) {}

  @Get()
  list(@Query() query: AdminAdQuery) {
    return this.adService.listForAdmin(query);
  }

  @Get('revenue')
  revenue() {
    return this.adService.revenueSummary();
  }

  @Patch(':id/refund')
  refund(@Param('id', ParseUUIDPipe) id: string) {
    return this.adService.refund(id);
  }

  /** 관리자 강제 순위 — 특정 광고를 세그먼트 상단에 고정 */
  @Patch(':id/priority')
  setPriority(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PriorityDto) {
    return this.adService.setAdminPriority(id, dto.priority);
  }
}
