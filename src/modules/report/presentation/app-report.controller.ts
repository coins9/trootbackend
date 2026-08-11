import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CurrentUser } from '../../../shared/auth/guards';
import { ReportService } from '../application/report.service';
import { ReportReason, ReportTargetType } from '../domain/report.entity';

class CreateReportDto {
  @IsEnum(ReportTargetType)
  targetType: ReportTargetType;

  @IsUUID()
  targetId: string;

  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @IsEnum(ReportReason)
  reason: ReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  detail?: string;
}

@Controller('app/reports')
export class AppReportController {
  constructor(private readonly reportService: ReportService) {}

  /** 신고 접수 — 남용 방지를 위해 분당 5건으로 제한 */
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  create(@CurrentUser('id') reporterId: string, @Body() dto: CreateReportDto) {
    return this.reportService.create({ reporterId, ...dto });
  }
}
