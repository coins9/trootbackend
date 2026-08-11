import { Global, Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

// 다른 모듈(작품·리뷰·상품)이 삭제 시 재사용할 수 있도록 전역 등록
@Global()
@Module({
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
