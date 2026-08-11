import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser, Roles } from '../../../shared/auth/guards';
import { OffsetPaginationQuery } from '../../../shared/http/pagination.dto';
import { UserRole, UserStatus } from '../../user/domain/user.entity';
import { ReportService } from '../application/report.service';
import { ReportStatus } from '../domain/report.entity';

class AdminReportQuery extends OffsetPaginationQuery {
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;
}

class UpdateReportStatusDto {
  @IsEnum(ReportStatus)
  status: ReportStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class SanctionDto {
  @IsEnum(UserStatus)
  status: UserStatus;
}

@Controller('admin/reports')
@Roles(UserRole.ADMIN)
export class AdminReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get()
  list(@Query() query: AdminReportQuery) {
    return this.reportService.listForAdmin(query);
  }

  @Get('pending-count')
  async pendingCount() {
    return { count: await this.reportService.pendingCount() };
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReportStatusDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.reportService.updateStatus(id, dto.status, adminId, dto.note);
  }

  @Patch('users/:userId/sanction')
  async sanction(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: SanctionDto,
    @CurrentUser('id') adminId: string,
  ) {
    await this.reportService.sanctionUser(userId, dto.status, adminId);
    return { userId, status: dto.status };
  }
}
