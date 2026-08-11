import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheService, CacheTtl } from '../../../shared/cache/cache.service';
import { AppException } from '../../../shared/exceptions/app.exception';
import { ErrorCode } from '../../../shared/exceptions/error-code';
import {
  DocumentLocale, DocumentSlug, DocumentStatus, LegalDocument,
} from '../domain/legal-document.entity';

export interface PublicDocument {
  slug: DocumentSlug;
  locale: DocumentLocale;
  title: string;
  body: string;
  version: number;
  effectiveAt: string | null;
  updatedAt: string;
}

export interface UpsertDocumentCommand {
  slug: DocumentSlug;
  locale: DocumentLocale;
  title: string;
  body: string;
  effectiveAt?: string;
  /** 본문이 실질적으로 바뀌어 재동의가 필요한 경우 true */
  bumpVersion?: boolean;
}

const docKey = (slug: string, locale: string) => `content:doc:${slug}:${locale}`;
const indexKey = (locale: string) => `content:index:${locale}`;

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(LegalDocument) private readonly docs: Repository<LegalDocument>,
    private readonly cache: CacheService,
  ) {}

  /**
   * 공개 조회. 홍보 웹사이트와 앱이 동일하게 사용한다.
   * 법적 문서는 거의 변하지 않으므로 길게 캐싱해 DB 부하를 사실상 0으로 만든다.
   */
  async getPublished(slug: DocumentSlug, locale: DocumentLocale): Promise<PublicDocument> {
    const doc = await this.cache.wrap(docKey(slug, locale), CacheTtl.AGGREGATE, async () => {
      const found = await this.docs.findOne({
        where: { slug, locale, status: DocumentStatus.PUBLISHED },
      });
      // 요청 언어본이 없으면 한국어로 폴백 — 빈 페이지로 인한 심사 반려를 막는다
      const fallback =
        found ??
        (locale !== DocumentLocale.KO
          ? await this.docs.findOne({
              where: { slug, locale: DocumentLocale.KO, status: DocumentStatus.PUBLISHED },
            })
          : null);

      return fallback ? this.toPublic(fallback) : null;
    });

    if (!doc) throw new AppException(ErrorCode.NOT_FOUND, { details: { slug, locale } });
    return doc;
  }

  /** 사이트 푸터/앱 설정 화면에서 링크 목록을 만들 때 사용 */
  async listPublished(locale: DocumentLocale) {
    return this.cache.wrap(indexKey(locale), CacheTtl.AGGREGATE, async () => {
      const rows = await this.docs.find({
        where: { locale, status: DocumentStatus.PUBLISHED },
        select: { slug: true, title: true, version: true, effectiveAt: true, updatedAt: true },
        order: { slug: 'ASC' },
      });
      return rows.map((r) => ({
        slug: r.slug,
        title: r.title,
        version: r.version,
        effectiveAt: r.effectiveAt?.toISOString() ?? null,
        updatedAt: r.updatedAt.toISOString(),
      }));
    });
  }

  // ── 관리자 ────────────────────────────────────────────────

  async listForAdmin(): Promise<LegalDocument[]> {
    return this.docs.find({ order: { slug: 'ASC', locale: 'ASC' } });
  }

  async getForAdmin(slug: DocumentSlug, locale: DocumentLocale): Promise<LegalDocument> {
    const doc = await this.docs.findOne({ where: { slug, locale } });
    if (!doc) throw new AppException(ErrorCode.NOT_FOUND, { details: { slug, locale } });
    return doc;
  }

  /** slug+locale 단위 upsert — 관리자 화면에서 저장 시 신규/수정을 구분할 필요가 없다 */
  async upsert(command: UpsertDocumentCommand, adminId: string): Promise<LegalDocument> {
    const existing = await this.docs.findOne({
      where: { slug: command.slug, locale: command.locale },
    });

    const doc =
      existing ??
      this.docs.create({
        slug: command.slug,
        locale: command.locale,
        status: DocumentStatus.DRAFT,
        version: 1,
      });

    doc.title = command.title;
    doc.body = command.body;
    doc.updatedBy = adminId;
    if (command.effectiveAt) doc.effectiveAt = new Date(command.effectiveAt);
    if (command.bumpVersion && existing) doc.version = existing.version + 1;

    const saved = await this.docs.save(doc);
    await this.invalidate(saved.slug, saved.locale);
    return saved;
  }

  async publish(slug: DocumentSlug, locale: DocumentLocale, adminId: string): Promise<LegalDocument> {
    const doc = await this.getForAdmin(slug, locale);

    doc.status = DocumentStatus.PUBLISHED;
    doc.publishedAt = new Date();
    doc.updatedBy = adminId;
    // 시행일 미지정 시 게시 시점으로 채워 문서 상단 표기가 비지 않게 한다
    if (!doc.effectiveAt) doc.effectiveAt = doc.publishedAt;

    const saved = await this.docs.save(doc);
    await this.invalidate(slug, locale);
    return saved;
  }

  async unpublish(slug: DocumentSlug, locale: DocumentLocale, adminId: string): Promise<LegalDocument> {
    const doc = await this.getForAdmin(slug, locale);
    doc.status = DocumentStatus.DRAFT;
    doc.updatedBy = adminId;

    const saved = await this.docs.save(doc);
    await this.invalidate(slug, locale);
    return saved;
  }

  private async invalidate(slug: DocumentSlug, locale: DocumentLocale): Promise<void> {
    await this.cache.del(docKey(slug, locale), indexKey(locale));
  }

  private toPublic(doc: LegalDocument): PublicDocument {
    return {
      slug: doc.slug,
      locale: doc.locale,
      title: doc.title,
      body: doc.body,
      version: doc.version,
      effectiveAt: doc.effectiveAt?.toISOString() ?? null,
      updatedAt: doc.updatedAt.toISOString(),
    };
  }
}
