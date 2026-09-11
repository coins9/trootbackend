import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import {
  IsDateString, IsNumber, IsOptional, IsString, Length, Max, Min,
} from 'class-validator';
import { CurrentUser, Public } from '../../../shared/auth/guards';
import { StudioService } from '../application/studio.service';

class RegisterStudioDto {
  @IsString() @Length(2, 100) name: string;
  @IsString() @Length(2, 500) address: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) lat?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) lng?: number;
}

class JoinStudioDto {
  @IsString() @Length(6, 6) code: string;
}

class UpdateStudioDto {
  @IsOptional() @IsString() @Length(2, 100) name?: string;
  @IsOptional() @IsString() @Length(2, 500) address?: string;
  // 주소 밑 자유 정보(소개·영업시간·공지). 빈 문자열이면 해제
  @IsOptional() @IsString() @Length(0, 2000) info?: string;
}

class ScheduleQuery {
  @IsDateString() date: string;
}

class ScheduleRangeQuery {
  @IsDateString() from: string;
  @IsDateString() to: string;
}

@Controller('app/studios')
export class AppStudioController {
  constructor(private readonly studioService: StudioService) {}

  @Get('me')
  mine(@CurrentUser('id') userId: string) {
    return this.studioService.mine(userId);
  }

  /** 공개 프로필(타투이스트 안내)용 — 해당 유저가 속한 샵의 이름·주소·소개 */
  @Public()
  @Get('by-user/:userId')
  publicByUser(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.studioService.publicByUser(userId);
  }

  @Post()
  register(@CurrentUser('id') userId: string, @Body() dto: RegisterStudioDto) {
    return this.studioService.register(userId, dto);
  }

  /** 샵오너 전용 — 주소 밑 정보(소개·영업시간·공지) 등 수정 */
  @Patch('me')
  updateMine(@CurrentUser('id') userId: string, @Body() dto: UpdateStudioDto) {
    return this.studioService.updateMine(userId, dto);
  }

  @Post('join')
  join(@CurrentUser('id') userId: string, @Body() dto: JoinStudioDto) {
    return this.studioService.join(userId, dto.code.toUpperCase());
  }

  @Get(':id/members')
  members(
    @Param('id', ParseUUIDPipe) studioId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.studioService.members(studioId, userId);
  }

  @Post(':id/invite-code/refresh')
  refreshCode(
    @Param('id', ParseUUIDPipe) studioId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.studioService.refreshCode(studioId, userId);
  }

  @Get(':id/schedule/range')
  scheduleRange(
    @Param('id', ParseUUIDPipe) studioId: string,
    @CurrentUser('id') userId: string,
    @Query() query: ScheduleRangeQuery,
  ) {
    return this.studioService.scheduleRange(studioId, userId, query.from, query.to);
  }

  @Get(':id/schedule')
  schedule(
    @Param('id', ParseUUIDPipe) studioId: string,
    @CurrentUser('id') userId: string,
    @Query() query: ScheduleQuery,
  ) {
    return this.studioService.schedule(studioId, userId, query.date);
  }
}
