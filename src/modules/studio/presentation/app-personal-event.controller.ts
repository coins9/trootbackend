import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import {
  IsDateString, IsEnum, IsIn, IsNumber, IsOptional, IsString, Length, Max, Min,
} from 'class-validator';
import { CurrentUser } from '../../../shared/auth/guards';
import { PersonalEventKind, PersonalEventStatus } from '../domain/artist-personal-event.entity';
import { PersonalScheduleService } from '../application/personal-schedule.service';

class CreatePersonalEventDto {
  @IsDateString()    date: string;
  @IsNumber() @Min(0) @Max(23.99) startHour: number;
  @IsNumber() @Min(0.5) @Max(12) durationH: number;
  @IsString() @Length(1, 200)    title: string;
  @IsOptional() @IsString() @Length(0, 200) subtitle?: string;
  @IsIn(['procedure', 'consulting', 'retouch', 'meeting']) kind: PersonalEventKind;
  @IsOptional() @IsString() @Length(0, 100) customerName?: string;
  @IsOptional() @IsString() @Length(0, 100) bodyPart?: string;
  @IsOptional() @IsString()                 memo?: string;
  @IsOptional() @IsIn(['none', 'partial', 'paid']) depositStatus?: string;
  @IsOptional() @IsNumber() @Min(0)         depositAmount?: number;
}

class UpdatePersonalEventDto {
  @IsOptional() @IsDateString()    date?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(23.99) startHour?: number;
  @IsOptional() @IsNumber() @Min(0.5) @Max(12) durationH?: number;
  @IsOptional() @IsString() @Length(1, 200)    title?: string;
  @IsOptional() @IsString() @Length(0, 200)    subtitle?: string;
  @IsOptional() @IsIn(['procedure', 'consulting', 'retouch', 'meeting']) kind?: PersonalEventKind;
  @IsOptional() @IsIn(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']) status?: PersonalEventStatus;
  @IsOptional() @IsString() @Length(0, 100)    customerName?: string;
  @IsOptional() @IsString() @Length(0, 100)    bodyPart?: string;
  @IsOptional() @IsString()                    memo?: string;
  @IsOptional() @IsIn(['none', 'partial', 'paid']) depositStatus?: string;
  @IsOptional() @IsNumber() @Min(0)            depositAmount?: number;
}

class RangeQuery {
  @IsDateString() from: string;
  @IsDateString() to: string;
}

@Controller('app/personal-schedule')
export class AppPersonalEventController {
  constructor(private readonly svc: PersonalScheduleService) {}

  @Get()
  list(
    @CurrentUser('id') userId: string,
    @Query() q: RangeQuery,
  ) {
    return this.svc.list(userId, q.from, q.to);
  }

  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePersonalEventDto,
  ) {
    return this.svc.create(userId, dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdatePersonalEventDto,
  ) {
    return this.svc.update(id, userId, dto);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.remove(id, userId);
  }
}
