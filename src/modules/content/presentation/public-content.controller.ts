import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { IsEnum, IsOptional } from 'class-validator';
import { Public } from '../../../shared/auth/guards';
import { ContentService } from '../application/content.service';
import { DocumentLocale, DocumentSlug } from '../domain/legal-document.entity';

class LocaleQuery {
  @IsOptional()
  @IsEnum(DocumentLocale)
  lang: DocumentLocale = DocumentLocale.KO;
}

/**
 * 인증 없이 접근 가능한 문서 API.
 * 홍보 웹사이트(Cloudflare Pages)와 앱이 동일한 엔드포인트를 사용한다.
 */
@Controller('public/contents')
@Public()
export class PublicContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  // Cloudflare 엣지 캐시까지 활용해 오리진 요청 자체를 줄인다
  @Header('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400')
  list(@Query() query: LocaleQuery) {
    return this.contentService.listPublished(query.lang);
  }

  @Get(':slug')
  @Header('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400')
  get(@Param('slug') slug: DocumentSlug, @Query() query: LocaleQuery) {
    return this.contentService.getPublished(slug, query.lang);
  }
}
