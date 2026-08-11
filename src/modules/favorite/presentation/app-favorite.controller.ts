import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsArray, IsEnum, IsUUID } from 'class-validator';
import { CurrentUser } from '../../../shared/auth/guards';
import { CursorPaginationQuery } from '../../../shared/http/pagination.dto';
import { FavoriteService } from '../application/favorite.service';
import { FavoriteType } from '../domain/favorite.entity';

class ToggleDto {
  @IsEnum(FavoriteType) type: FavoriteType;
  @IsUUID() targetId: string;
}

class CheckDto {
  @IsEnum(FavoriteType) type: FavoriteType;
  @IsArray() targetIds: string[];
}

class ListQuery extends CursorPaginationQuery {
  @IsEnum(FavoriteType) type: FavoriteType;
}

@Controller('app/favorites')
export class AppFavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  @Get()
  list(@CurrentUser('id') userId: string, @Query() query: ListQuery) {
    return this.favoriteService.list(userId, query.type, query.cursor, query.limit);
  }

  @Post('toggle')
  toggle(@CurrentUser('id') userId: string, @Body() dto: ToggleDto) {
    return this.favoriteService.toggle(userId, dto.type, dto.targetId);
  }

  /** 목록 렌더링용 일괄 조회 */
  @Post('check')
  check(@CurrentUser('id') userId: string, @Body() dto: CheckDto) {
    return this.favoriteService.checkMany(userId, dto.type, dto.targetIds);
  }
}
