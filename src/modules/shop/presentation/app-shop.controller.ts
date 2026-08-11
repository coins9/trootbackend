import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsArray, IsEnum, IsInt, IsObject, IsOptional, IsString, Length, Min,
} from 'class-validator';
import { CurrentUser, Public } from '../../../shared/auth/guards';
import { CursorPaginationQuery } from '../../../shared/http/pagination.dto';
import { ShopService } from '../application/shop.service';
import { ShopPostCategory, ShopPostStatus } from '../domain/shop-post.entity';

class ShopListQueryDto extends CursorPaginationQuery {
  @IsEnum(ShopPostCategory) category: ShopPostCategory;
  @IsOptional() @IsString() region?: string;
}

class ShopPostDto {
  @IsEnum(ShopPostCategory) category: ShopPostCategory;
  @IsString() @Length(1, 100) title: string;
  @IsString() @Length(1, 2000) description: string;
  @IsOptional() @IsString() @Length(1, 100) region?: string;
  @IsOptional() @IsArray() images?: string[];
  @IsOptional() @IsObject() attributes?: Record<string, unknown>;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priceKrw?: number;
  @IsOptional() @IsString() @Length(1, 300) contact?: string;
}

class StatusDto {
  @IsEnum(ShopPostStatus) status: ShopPostStatus;
}

class ApplyDto {
  @IsOptional() @IsObject() answers?: Record<string, unknown>;
  @IsOptional() @IsString() @Length(1, 1000) message?: string;
}

@Controller('app/shop-posts')
export class AppShopController {
  constructor(private readonly shopService: ShopService) {}

  @Public()
  @Get()
  list(@Query() query: ShopListQueryDto) {
    return this.shopService.list(query);
  }

  @Get('me')
  mine(@CurrentUser('id') authorId: string, @Query() query: CursorPaginationQuery) {
    return this.shopService.listMine(authorId, query.cursor, query.limit);
  }

  @Post()
  create(@CurrentUser('id') authorId: string, @Body() dto: ShopPostDto) {
    return this.shopService.create(authorId, dto);
  }

  @Public()
  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.shopService.getDetail(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShopPostDto,
    @CurrentUser('id') authorId: string,
  ) {
    return this.shopService.update(id, authorId, dto);
  }

  @Patch(':id/status')
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StatusDto,
    @CurrentUser('id') authorId: string,
  ) {
    return this.shopService.setStatus(id, authorId, dto.status);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') authorId: string) {
    await this.shopService.remove(id, authorId);
    return { deleted: true };
  }

  @Post(':id/apply')
  apply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyDto,
    @CurrentUser('id') applicantId: string,
  ) {
    return this.shopService.apply(id, applicantId, dto.answers ?? {}, dto.message);
  }

  @Get(':id/applications')
  applications(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') authorId: string) {
    return this.shopService.listApplications(id, authorId);
  }
}
