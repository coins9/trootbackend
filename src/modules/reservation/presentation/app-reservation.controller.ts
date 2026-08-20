import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Min,
} from 'class-validator';
import { CurrentUser, Roles } from '../../../shared/auth/guards';
import { CursorPaginationQuery } from '../../../shared/http/pagination.dto';
import { UserRole } from '../../user/domain/user.entity';
import { ReservationService } from '../application/reservation.service';
import { DepositStatus, ReservationStatus } from '../domain/reservation.entity';

class CreateReservationDto {
  @IsUUID() artistPageId: string;
  @IsOptional() @IsUUID() artworkId?: string;
  @IsDateString() scheduledAt: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(15) durationMinutes?: number;
  @IsOptional() @IsString() @Length(1, 50) bodyPart?: string;
  @IsOptional() @IsString() @Length(1, 50) sizePreset?: string;
  @IsOptional() @IsString() @Length(1, 1000) memo?: string;
  @IsOptional() @IsArray() referenceImages?: string[];
}

class StatusDto {
  @IsEnum(ReservationStatus) status: ReservationStatus;
  @IsOptional() @IsString() @Length(1, 300) reason?: string;
}

class DepositDto {
  @Type(() => Number) @IsInt() @Min(0) amountKrw: number;
}

class ArtistListQuery extends CursorPaginationQuery {
  @IsOptional() @IsEnum(ReservationStatus) status?: ReservationStatus;
  @IsOptional() @IsEnum(DepositStatus) depositStatus?: DepositStatus;
}

class ScheduleQuery {
  @IsDateString() from: string;
  @IsDateString() to: string;
}

@Controller('app/reservations')
export class AppReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  @Post()
  create(@CurrentUser('id') customerId: string, @Body() dto: CreateReservationDto) {
    return this.reservationService.create({ customerId, ...dto });
  }

  @Get('me')
  mine(@CurrentUser('id') customerId: string, @Query() query: CursorPaginationQuery) {
    return this.reservationService.listForCustomer(customerId, query.cursor, query.limit);
  }

  @Get('me/reviewable')
  reviewable(@CurrentUser('id') customerId: string) {
    return this.reservationService.listReviewable(customerId);
  }

  // 고정 경로를 :id 보다 먼저 선언해야 라우팅이 겹치지 않는다
  @Get('artist')
  @Roles(UserRole.TATTOOIST, UserRole.ADMIN)
  forArtist(@CurrentUser('id') userId: string, @Query() query: ArtistListQuery) {
    return this.reservationService.listForArtist(
      userId, query.status, query.depositStatus, query.cursor, query.limit,
    );
  }

  @Get('artist/schedule')
  @Roles(UserRole.TATTOOIST, UserRole.ADMIN)
  schedule(@CurrentUser('id') userId: string, @Query() query: ScheduleQuery) {
    return this.reservationService.schedule(userId, query.from, query.to);
  }

  @Get('artist/deposits/summary')
  @Roles(UserRole.TATTOOIST, UserRole.ADMIN)
  depositSummary(@CurrentUser('id') userId: string) {
    return this.reservationService.depositSummary(userId);
  }

  /** 광고 및 통계 관리 화면 — 작품별 예약 요청(문의) 건수 */
  @Get('artist/counts-by-artwork')
  @Roles(UserRole.TATTOOIST, UserRole.ADMIN)
  countByArtwork(@CurrentUser('id') userId: string) {
    return this.reservationService.countByArtwork(userId);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.reservationService.getDetail(id, userId);
  }

  @Patch(':id/status')
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StatusDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.reservationService.changeStatus(id, dto.status, userId, dto.reason);
  }

  @Patch(':id/deposit/request')
  @Roles(UserRole.TATTOOIST, UserRole.ADMIN)
  requestDeposit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DepositDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.reservationService.requestDeposit(id, userId, dto.amountKrw);
  }

  @Patch(':id/deposit/confirm')
  @Roles(UserRole.TATTOOIST, UserRole.ADMIN)
  confirmDeposit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.reservationService.confirmDeposit(id, userId);
  }
}
