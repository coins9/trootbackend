import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsArray, IsEnum, IsInt, IsLatitude, IsLongitude, IsNumber, IsOptional,
  IsString, Length, Max, Min,
} from 'class-validator';
import { CurrentUser, Public, Roles } from '../../../shared/auth/guards';
import { CursorPaginationQuery } from '../../../shared/http/pagination.dto';
import { UserRole } from '../../user/domain/user.entity';
import { ArtistService } from '../application/artist.service';
import { ArtworkType } from '../domain/artwork.entity';

class ArtistListQueryDto extends CursorPaginationQuery {
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() genre?: string;
  @IsOptional() @IsEnum(['recent', 'rating', 'popular']) sort?: 'recent' | 'rating' | 'popular';

  @IsOptional() @Type(() => Number) @IsLatitude() lat?: number;
  @IsOptional() @Type(() => Number) @IsLongitude() lng?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(100) radiusKm?: number;
}

class FeedQueryDto extends CursorPaginationQuery {
  @IsOptional() @IsEnum(['recent', 'popular']) sort?: 'recent' | 'popular';
  @IsOptional() @IsString() @Length(2, 2) countryCode?: string;
  @IsOptional() @IsString() @Length(1, 50) regionSido?: string;
  @IsOptional() @IsString() @Length(1, 50) regionSigungu?: string;
  @IsOptional() @IsString() @Length(1, 50) bodyPart?: string;
  @IsOptional() @IsString() genre?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priceMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priceMax?: number;
}

class CreateArtistPageDto {
  @IsString() @Length(1, 100) pageName: string;
  @IsString() @Length(2, 50) handle: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() @Length(1, 50) regionSido?: string;
  @IsOptional() @IsString() @Length(1, 50) regionSigungu?: string;
}

class UpdateArtistPageDto {
  @IsOptional() @IsString() @Length(1, 100) pageName?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() profileImage?: string;
  @IsOptional() @IsString() coverImage?: string;
  @IsOptional() @IsString() @Length(1, 50) regionSido?: string;
  @IsOptional() @IsString() @Length(1, 50) regionSigungu?: string;
  @IsOptional() @IsArray() genres?: string[];
  @IsOptional() @IsArray() tags?: string[];
  @IsOptional() @Type(() => Number) @IsLatitude() lat?: number;
  @IsOptional() @Type(() => Number) @IsLongitude() lng?: number;
  @IsOptional() @IsString() @Length(2, 2) countryCode?: string;
  @IsOptional() @IsString() @Length(1, 100) countryName?: string;
  @IsOptional() @IsEnum(['domestic', 'overseas']) regionType?: string;
}

class ArtworkDto {
  @IsOptional() @IsEnum(ArtworkType) type?: ArtworkType;
  @IsString() @Length(1, 200) title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() images?: string[];
  @IsOptional() @IsString() thumbnail?: string;
  @IsOptional() @IsArray() genres?: string[];
  @IsOptional() @IsString() @Length(1, 50) bodyPart?: string;
  @IsOptional() @IsString() @Length(1, 50) sizePreset?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priceKrw?: number;
}

@Controller('app/artists')
export class AppArtistController {
  constructor(private readonly artistService: ArtistService) {}

  /** 홈 상단 Selected Master */
  @Public()
  @Get('selected-masters')
  selectedMasters() {
    return this.artistService.getSelectedMasters();
  }

  @Public()
  @Get()
  list(@Query() query: ArtistListQueryDto) {
    return this.artistService.list(query);
  }

  /** 홈 작품 피드 */
  @Public()
  @Get('feed')
  feed(@Query() query: FeedQueryDto) {
    return this.artistService.feed(query.cursor, query.limit, query.sort, {
      countryCode: query.countryCode,
      regionSido: query.regionSido,
      regionSigungu: query.regionSigungu,
      genre: query.genre,
      bodyPart: query.bodyPart,
      priceMin: query.priceMin,
      priceMax: query.priceMax,
    });
  }

  /** 내 타투이스트 페이지 — :id 보다 먼저 선언해야 라우팅이 겹치지 않는다.
   *  역할 미분리: 일반 유저도 자신의 페이지 유무를 확인해야 하므로 인증만 요구한다. */
  @Get('me')
  me(@CurrentUser('id') userId: string) {
    return this.artistService.getByUserId(userId);
  }

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateArtistPageDto) {
    return this.artistService.createPage(userId, dto);
  }

  @Patch('me')
  @Roles(UserRole.TATTOOIST, UserRole.ADMIN)
  update(@CurrentUser('id') userId: string, @Body() dto: UpdateArtistPageDto) {
    return this.artistService.updatePage(userId, dto);
  }

  /** 무료 UP (1일 1회) */
  @Post('me/up')
  @Roles(UserRole.TATTOOIST, UserRole.ADMIN)
  freeUp(@CurrentUser('id') userId: string) {
    return this.artistService.freeUp(userId);
  }

  @Get('me/artworks')
  async myArtworks(@CurrentUser('id') userId: string, @Query() query: CursorPaginationQuery) {
    const artist = await this.artistService.getByUserId(userId);
    return this.artistService.listArtworks(artist.id, query.cursor, query.limit);
  }

  @Post('me/artworks')
  @Roles(UserRole.TATTOOIST, UserRole.ADMIN)
  createArtwork(@CurrentUser('id') userId: string, @Body() dto: ArtworkDto) {
    return this.artistService.createArtwork(userId, dto);
  }

  @Patch('me/artworks/:artworkId')
  @Roles(UserRole.TATTOOIST, UserRole.ADMIN)
  updateArtwork(
    @CurrentUser('id') userId: string,
    @Param('artworkId', ParseUUIDPipe) artworkId: string,
    @Body() dto: ArtworkDto,
  ) {
    return this.artistService.updateArtwork(userId, artworkId, dto);
  }

  @Delete('me/artworks/:artworkId')
  @Roles(UserRole.TATTOOIST, UserRole.ADMIN)
  async deleteArtwork(
    @CurrentUser('id') userId: string,
    @Param('artworkId', ParseUUIDPipe) artworkId: string,
  ) {
    await this.artistService.deleteArtwork(userId, artworkId);
    return { deleted: true };
  }

  @Public()
  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.artistService.getDetail(id);
  }

  @Public()
  @Get(':id/artworks')
  artworks(@Param('id', ParseUUIDPipe) id: string, @Query() query: CursorPaginationQuery) {
    return this.artistService.listArtworks(id, query.cursor, query.limit);
  }
}
