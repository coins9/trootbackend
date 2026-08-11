import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import {
  IsBoolean, IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength,
} from 'class-validator';
import { CurrentUser, Roles } from '../../../shared/auth/guards';
import { UserRole } from '../../user/domain/user.entity';
import { ContentService } from '../application/content.service';
import { DocumentLocale, DocumentSlug } from '../domain/legal-document.entity';

class UpsertDocumentDto {
  @IsEnum(DocumentSlug)
  slug: DocumentSlug;

  @IsEnum(DocumentLocale)
  locale: DocumentLocale;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsString()
  @MinLength(1)
  body: string;

  @IsOptional()
  @IsDateString()
  effectiveAt?: string;

  @IsOptional()
  @IsBoolean()
  bumpVersion?: boolean;
}

class DocumentLocaleQuery {
  @IsEnum(DocumentLocale)
  locale: DocumentLocale;
}

@Controller('admin/contents')
@Roles(UserRole.ADMIN)
export class AdminContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  list() {
    return this.contentService.listForAdmin();
  }

  @Get(':slug')
  get(@Param('slug') slug: DocumentSlug, @Query() query: DocumentLocaleQuery) {
    return this.contentService.getForAdmin(slug, query.locale);
  }

  @Put()
  upsert(@Body() dto: UpsertDocumentDto, @CurrentUser('id') adminId: string) {
    return this.contentService.upsert(dto, adminId);
  }

  @Post(':slug/publish')
  publish(
    @Param('slug') slug: DocumentSlug,
    @Query() query: DocumentLocaleQuery,
    @CurrentUser('id') adminId: string,
  ) {
    return this.contentService.publish(slug, query.locale, adminId);
  }

  @Post(':slug/unpublish')
  unpublish(
    @Param('slug') slug: DocumentSlug,
    @Query() query: DocumentLocaleQuery,
    @CurrentUser('id') adminId: string,
  ) {
    return this.contentService.unpublish(slug, query.locale, adminId);
  }
}
