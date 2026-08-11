import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentService } from './application/content.service';
import { SettingService } from './application/setting.service';
import { LegalDocument } from './domain/legal-document.entity';
import { SiteSetting } from './domain/site-setting.entity';
import { AdminContentController } from './presentation/admin-content.controller';
import { PublicContentController } from './presentation/public-content.controller';
import {
  AdminSettingController, PublicSettingController,
} from './presentation/setting.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LegalDocument, SiteSetting])],
  controllers: [
    PublicContentController,
    AdminContentController,
    PublicSettingController,
    AdminSettingController,
  ],
  providers: [ContentService, SettingService],
  exports: [ContentService, SettingService],
})
export class ContentModule {}
