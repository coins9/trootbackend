import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsArray, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min,
} from 'class-validator';
import { CurrentUser, Public, Roles } from '../../../shared/auth/guards';
import { CursorPaginationQuery } from '../../../shared/http/pagination.dto';
import { UserRole } from '../../user/domain/user.entity';
import { ReviewService } from '../application/review.service';

class CreateReviewDto {
  @IsUUID() reservationId: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(5) painScore: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(5) kindnessScore: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(5) hygieneScore: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(5) satisfactionScore: number;
  @IsString() @Length(10, 500) body: string;
  @IsOptional() @IsArray() images?: string[];
}

class HealedDto {
  @IsArray() images: string[];
}

class ReplyDto {
  @IsString() @Length(1, 500) body: string;
}

@Controller('app/reviews')
export class AppReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  create(@CurrentUser('id') authorId: string, @Body() dto: CreateReviewDto) {
    return this.reviewService.create({ authorId, ...dto });
  }

  @Get('me')
  mine(@CurrentUser('id') authorId: string, @Query() query: CursorPaginationQuery) {
    return this.reviewService.listMine(authorId, query.cursor, query.limit);
  }

  @Public()
  @Get('artists/:artistPageId')
  byArtist(
    @Param('artistPageId', ParseUUIDPipe) artistPageId: string,
    @Query() query: CursorPaginationQuery,
  ) {
    return this.reviewService.listByArtist(artistPageId, query.cursor, query.limit);
  }

  @Public()
  @Get('artists/:artistPageId/summary')
  summary(@Param('artistPageId', ParseUUIDPipe) artistPageId: string) {
    return this.reviewService.scoreSummary(artistPageId);
  }

  @Post(':id/healed')
  healed(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HealedDto,
    @CurrentUser('id') authorId: string,
  ) {
    return this.reviewService.addHealedImages(id, authorId, dto.images);
  }

  @Post(':id/reply')
  @Roles(UserRole.TATTOOIST, UserRole.ADMIN)
  reply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplyDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.reviewService.reply(id, userId, dto.body);
  }
}
