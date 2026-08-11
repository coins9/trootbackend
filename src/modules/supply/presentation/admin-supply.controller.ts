import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { IsEnum, IsOptional } from 'class-validator';
import { Roles } from '../../../shared/auth/guards';
import { OffsetPaginationQuery } from '../../../shared/http/pagination.dto';
import { UserRole } from '../../user/domain/user.entity';
import { SupplyService } from '../application/supply.service';
import { SettlementStatus, VendorStatus } from '../domain/supply.entity';

class VendorQuery extends OffsetPaginationQuery {
  @IsOptional() @IsEnum(VendorStatus) status?: VendorStatus;
}

class SettlementQuery extends OffsetPaginationQuery {
  @IsOptional() @IsEnum(SettlementStatus) status?: SettlementStatus;
}

class VendorStatusDto {
  @IsEnum(VendorStatus) status: VendorStatus;
}

@Controller('admin')
@Roles(UserRole.ADMIN)
export class AdminSupplyController {
  constructor(private readonly supplyService: SupplyService) {}

  @Get('vendors')
  vendors(@Query() query: VendorQuery) {
    return this.supplyService.listVendorsForAdmin(query);
  }

  @Patch('vendors/:id/status')
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: VendorStatusDto) {
    return this.supplyService.setVendorStatus(id, dto.status);
  }

  @Get('settlements')
  settlements(@Query() query: SettlementQuery) {
    return this.supplyService.listSettlements(query);
  }

  @Get('settlements/summary')
  summary() {
    return this.supplyService.settlementSummary();
  }

  @Patch('settlements/:id/paid')
  markPaid(@Param('id', ParseUUIDPipe) id: string) {
    return this.supplyService.markSettlementPaid(id);
  }
}
