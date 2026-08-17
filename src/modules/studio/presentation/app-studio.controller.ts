import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, Query,
} from '@nestjs/common';
import {
  IsDateString, IsNumber, IsOptional, IsString, Length, Max, Min,
} from 'class-validator';
import { CurrentUser } from '../../../shared/auth/guards';
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

class ScheduleQuery {
  @IsDateString() date: string;
}

@Controller('app/studios')
export class AppStudioController {
  constructor(private readonly studioService: StudioService) {}

  @Get('me')
  mine(@CurrentUser('id') userId: string) {
    return this.studioService.mine(userId);
  }

  @Post()
  register(@CurrentUser('id') userId: string, @Body() dto: RegisterStudioDto) {
    return this.studioService.register(userId, dto);
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

  @Get(':id/schedule')
  schedule(
    @Param('id', ParseUUIDPipe) studioId: string,
    @CurrentUser('id') userId: string,
    @Query() query: ScheduleQuery,
  ) {
    return this.studioService.schedule(studioId, userId, query.date);
  }
}
