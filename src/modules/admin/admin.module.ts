import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdModule } from '../ad/ad.module';
import { ArtistModule } from '../artist/artist.module';
import { ReportModule } from '../report/report.module';
import { SupplyModule } from '../supply/supply.module';
import { User } from '../user/domain/user.entity';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    ReportModule,
    ArtistModule,
    AdModule,
    SupplyModule,
  ],
  controllers: [AdminController],
})
export class AdminModule {}
