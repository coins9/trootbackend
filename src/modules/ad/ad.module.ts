import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Artwork } from '../artist/domain/artwork.entity';
import { AdService } from './application/ad.service';
import { AdCampaign } from './domain/campaign.entity';
import { AdminAdController } from './presentation/admin-ad.controller';
import { AppAdController } from './presentation/app-ad.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AdCampaign, Artwork])],
  controllers: [AppAdController, AdminAdController],
  providers: [AdService],
  exports: [AdService],
})
export class AdModule {}
