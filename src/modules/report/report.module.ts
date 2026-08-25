import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SlackModule } from '../../shared/slack/slack.module';
import { User } from '../user/domain/user.entity';
import { Report } from './domain/report.entity';
import { ReportService } from './application/report.service';
import { AppReportController } from './presentation/app-report.controller';
import { AdminReportController } from './presentation/admin-report.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Report, User]), SlackModule],
  controllers: [AppReportController, AdminReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
