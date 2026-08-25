import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createGzip } from 'node:zlib';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { PassThrough } from 'node:stream';

const execAsync = promisify(exec);

/** 보관 기간 — 30일 초과 백업은 자동 삭제 */
const RETENTION_DAYS = 30;
/** 백업 파일 접두사 */
const BACKUP_PREFIX = 'troot_backup_';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly dbUrl: string;

  constructor(private readonly config: ConfigService) {
    const accountId = config.get<string>('r2.accountId')!;
    const accessKeyId = config.get<string>('r2.accessKeyId')!;
    const secretAccessKey = config.get<string>('r2.secretAccessKey')!;

    // DB 백업은 images 버킷이 아닌 별도 backups 버킷 사용
    this.bucket = config.get<string>('r2.backupBucket') || 'troot-backups';

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });

    const host = config.get<string>('database.host')!;
    const port = config.get<number>('database.port')!;
    const user = config.get<string>('database.username')!;
    const pass = config.get<string>('database.password')!;
    const name = config.get<string>('database.name')!;
    // pg_dump 연결 URL — 패스워드를 PGPASSWORD 환경변수로 전달해 쉘 이스케이프 문제 방지
    this.dbUrl = `postgresql://${user}:${encodeURIComponent(pass)}@${host}:${port}/${name}`;
  }

  /** 매일 KST 03:00 (UTC 18:00) 자동 실행 */
  @Cron('0 18 * * *', { name: 'db-backup', timeZone: 'UTC' })
  async runScheduled(): Promise<void> {
    this.logger.log('DB 자동 백업 시작');
    await this.backup();
  }

  /** 수동 실행 엔드포인트에서도 호출 가능하도록 public */
  async backup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '_');
    const key = `${BACKUP_PREFIX}${timestamp}.sql.gz`;

    try {
      // pg_dump를 stdout으로 출력하고 Node.js 스트림에서 gzip 압축
      const gzipBuffer = await this.dumpAndCompress();

      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: gzipBuffer,
          ContentType: 'application/gzip',
          Metadata: { 'created-at': new Date().toISOString() },
        }),
      );

      this.logger.log(`백업 완료: ${key} (${(gzipBuffer.length / 1024).toFixed(1)} KB)`);

      // 보관 기간 초과 파일 정리
      await this.purgeOldBackups();

      return key;
    } catch (e) {
      this.logger.error('백업 실패', (e as Error).message);
      throw e;
    }
  }

  private async dumpAndCompress(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // PGPASSWORD 환경변수로 패스워드 전달 — URL 인코딩 특수문자 문제 우회
      const host = this.config.get<string>('database.host')!;
      const port = this.config.get<number>('database.port')!;
      const user = this.config.get<string>('database.username')!;
      const pass = this.config.get<string>('database.password')!;
      const name = this.config.get<string>('database.name')!;

      // --no-password: 패스워드 프롬프트 방지 (PGPASSWORD로 전달)
      // --clean: DROP 포함 — 복원 시 기존 오브젝트 덮어쓰기 가능
      // --if-exists: DROP 시 오류 무시
      const cmd = `pg_dump --host=${host} --port=${port} --username=${user} --dbname=${name} --no-password --clean --if-exists --format=plain`;

      const env = { ...process.env, PGPASSWORD: pass };

      const child = require('node:child_process').spawn(
        cmd.split(' ')[0],
        cmd.split(' ').slice(1),
        { env, stdio: ['ignore', 'pipe', 'pipe'] },
      );

      const gzip = createGzip({ level: 9 });
      const chunks: Buffer[] = [];

      child.stdout.pipe(gzip);
      gzip.on('data', (chunk: Buffer) => chunks.push(chunk));
      gzip.on('end', () => resolve(Buffer.concat(chunks)));
      gzip.on('error', reject);

      let stderrOutput = '';
      child.stderr.on('data', (d: Buffer) => { stderrOutput += d.toString(); });

      child.on('close', (code: number) => {
        if (code !== 0) {
          reject(new Error(`pg_dump 종료코드 ${code}: ${stderrOutput}`));
        }
      });
      child.on('error', reject);
    });
  }

  /** R2 버킷에서 RETENTION_DAYS 초과 백업 파일 삭제 */
  private async purgeOldBackups(): Promise<void> {
    try {
      const res = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: BACKUP_PREFIX }),
      );

      const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
      const toDelete = (res.Contents ?? []).filter(
        (obj) => obj.Key && obj.LastModified && obj.LastModified.getTime() < cutoff,
      );

      for (const obj of toDelete) {
        await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: obj.Key! }));
        this.logger.log(`오래된 백업 삭제: ${obj.Key}`);
      }
    } catch (e) {
      // 정리 실패는 경고만 — 다음 실행에서 재시도
      this.logger.warn('오래된 백업 정리 실패', (e as Error).message);
    }
  }
}
