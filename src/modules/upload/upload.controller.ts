import { Body, Controller, Delete, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsString, IsUrl, Max, Min } from 'class-validator';
import { CurrentUser } from '../../shared/auth/guards';
import { UploadService } from './upload.service';
import type { UploadScope } from './upload.service';

class PresignDto {
  @IsEnum(['artwork', 'review', 'profile', 'product', 'shop', 'misc'])
  scope: UploadScope;

  @IsString()
  contentType: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(15 * 1024 * 1024)
  size: number;
}

class DeleteUploadDto {
  @IsString()
  @IsUrl()
  url: string;
}

@Controller('app/uploads')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * 업로드 URL 발급.
   * 남용 방지를 위해 분당 30건으로 제한 — 정상 다중 업로드(최대 10장)는 충분히 커버.
   */
  @Post('presign')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  presign(@CurrentUser('id') userId: string, @Body() dto: PresignDto) {
    return this.uploadService.presign({ ...dto, userId });
  }

  /**
   * 업로드된 이미지 삭제.
   * 자신의 CDN 도메인 URL 이 아니면 서비스가 조용히 무시한다.
   */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUpload(
    @CurrentUser('id') _userId: string,
    @Body() dto: DeleteUploadDto,
  ): Promise<void> {
    await this.uploadService.deleteByUrl(dto.url);
  }
}
