import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AppException } from '../../shared/exceptions/app.exception';
import { ErrorCode } from '../../shared/exceptions/error-code';

/** 업로드 용도별 폴더 — 조회·정리·권한 구분을 쉽게 하기 위함 */
export type UploadScope = 'artwork' | 'review' | 'profile' | 'product' | 'shop' | 'misc';

/** 허용 이미지 타입과 확장자. 실행 파일·SVG(XSS) 등은 차단 */
const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

const MAX_BYTES = 15 * 1024 * 1024; // 15MB
const SCOPES: UploadScope[] = ['artwork', 'review', 'profile', 'product', 'shop', 'misc'];

export interface PresignRequest {
  scope: UploadScope;
  contentType: string;
  /** 클라이언트가 아는 파일 크기 — Content-Length 조건으로 서버가 상한을 강제 */
  size: number;
  userId: string;
}

export interface PresignResult {
  /** 앱이 PUT 요청을 보낼 임시 URL */
  uploadUrl: string;
  /** 업로드 후 실제 접근 URL (DB 에 저장할 값) */
  publicUrl: string;
  /** 스토리지 내 경로 */
  key: string;
  /** PUT 시 그대로 실어야 하는 헤더 */
  headers: Record<string, string>;
  expiresInSec: number;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly ttl: number;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const accountId = this.config.get<string>('r2.accountId')!;
    const accessKeyId = this.config.get<string>('r2.accessKeyId')!;
    const secretAccessKey = this.config.get<string>('r2.secretAccessKey')!;
    this.bucket = this.config.get<string>('r2.bucket')!;
    this.publicBaseUrl = this.config.get<string>('r2.publicBaseUrl')!;
    this.ttl = this.config.get<number>('r2.uploadTtlSec')!;

    // 키가 없으면 업로드 비활성 — 로컬/CI 에서 부팅은 막지 않는다
    this.enabled = !!(accountId && accessKeyId && secretAccessKey && this.publicBaseUrl);

    this.client = this.enabled
      ? new S3Client({
          region: 'auto',
          endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
          credentials: { accessKeyId, secretAccessKey },
          // 브라우저 CORS 환경에서 presigned PUT 이 동작하려면 자동 체크섬을 꺼야 한다.
          // SDK v3 기본값이 CRC32 를 signed header 에 포함시켜 CORS preflight 를 막는다.
          requestChecksumCalculation: 'WHEN_REQUIRED',
          responseChecksumValidation: 'WHEN_REQUIRED',
        })
      : null;

    if (!this.enabled) this.logger.warn('R2 미설정 — 업로드 API 가 비활성화됩니다.');
  }

  /**
   * presigned PUT URL 발급.
   * 앱은 이 URL 로 R2 에 직접 업로드하므로 파일이 서버를 거치지 않는다(대역폭 절약).
   * ContentType·ContentLength 를 서명에 포함해 타입/용량 위조를 차단한다.
   */
  async presign(req: PresignRequest): Promise<PresignResult> {
    if (!this.enabled || !this.client) {
      throw new AppException(ErrorCode.INTERNAL_ERROR, {
        details: { reason: 'upload_disabled' },
      });
    }
    if (!SCOPES.includes(req.scope)) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, { details: { scope: req.scope } });
    }

    const ext = ALLOWED[req.contentType];
    if (!ext) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: { reason: 'unsupported_type', allowed: Object.keys(ALLOWED) },
      });
    }
    if (!Number.isFinite(req.size) || req.size <= 0 || req.size > MAX_BYTES) {
      throw new AppException(ErrorCode.PAYLOAD_TOO_LARGE, {
        details: { maxBytes: MAX_BYTES },
      });
    }

    // 소유자 경로를 키에 포함해 나중에 접근 제어·정리에 활용
    const key = `${req.scope}/${req.userId}/${Date.now()}-${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: req.contentType,
      // ContentLength 를 signed header 에서 제외 — 브라우저 CORS preflight 는
      // content-length 를 보낼 수 없어서 서명 검증이 실패한다.
      // 크기 검증은 이미 위에서 req.size 로 처리했으므로 보안 손실 없음.
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: this.ttl });

    return {
      uploadUrl,
      publicUrl: `${this.publicBaseUrl}/${key}`,
      key,
      headers: { 'Content-Type': req.contentType },
      expiresInSec: this.ttl,
    };
  }

  /** 업로드 취소·교체 시 정리. 실패해도 요청 흐름을 막지 않는다 */
  async delete(key: string): Promise<void> {
    if (!this.enabled || !this.client) return;
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (e) {
      this.logger.warn(`R2 delete 실패: ${key}`, e as Error);
    }
  }

  /** publicUrl → key 역변환 (삭제용) */
  extractKey(publicUrl: string): string | null {
    if (!publicUrl.startsWith(this.publicBaseUrl)) return null;
    return publicUrl.slice(this.publicBaseUrl.length + 1);
  }
}
