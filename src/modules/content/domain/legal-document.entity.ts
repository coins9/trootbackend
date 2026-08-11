import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/database/base.entity';

/**
 * 앱스토어/플레이스토어 심사에 필요한 필수 문서 슬러그.
 * 값은 URL 경로에 직접 쓰이므로 변경하지 않는다.
 */
export enum DocumentSlug {
  /** 양 스토어 공통 필수 — 등록 URL 로 사용 */
  PRIVACY_POLICY = 'privacy-policy',
  TERMS_OF_SERVICE = 'terms-of-service',
  /** Apple 5.1.1(v) · Google 데이터 삭제 요청 URL 요건 */
  ACCOUNT_DELETION = 'account-deletion',
  /** 커뮤니티/UGC 앱 심사 시 요구되는 운영 정책 */
  COMMUNITY_GUIDELINES = 'community-guidelines',
  /** 신고·제재 기준 (앱 내 이용 안전 정책과 동일 내용) */
  SAFETY_POLICY = 'safety-policy',
  /** 미성년자 시술 관련 고지 */
  YOUTH_POLICY = 'youth-policy',
  SUPPORT = 'support',
}

export enum DocumentLocale {
  KO = 'ko',
  EN = 'en',
}

export enum DocumentStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

@Entity('legal_documents')
// 공개 조회 경로: slug + locale 단건. 문서당 언어별 1건만 존재
@Index('uq_legal_slug_locale', ['slug', 'locale'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
@Index('idx_legal_status', ['status'])
export class LegalDocument extends BaseEntity {
  @Column({ type: 'enum', enum: DocumentSlug })
  slug: DocumentSlug;

  @Column({ type: 'enum', enum: DocumentLocale })
  locale: DocumentLocale;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  /** 마크다운 원문. 렌더링은 클라이언트가 담당한다 */
  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'enum', enum: DocumentStatus, default: DocumentStatus.DRAFT })
  status: DocumentStatus;

  /**
   * 약관 개정 이력 추적용. 앱은 이 값이 올라가면 재동의를 받는다.
   * 스토어 심사에서도 '시행일' 표기가 요구된다.
   */
  @Column({ type: 'int', default: 1 })
  version: number;

  /** 시행일 — 문서 상단에 노출 */
  @Column({ type: 'timestamptz', nullable: true })
  effectiveAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;

  isPublished(): boolean {
    return this.status === DocumentStatus.PUBLISHED;
  }
}
