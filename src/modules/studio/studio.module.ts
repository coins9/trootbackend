import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtistPage } from '../artist/domain/artist.entity';
import { Reservation } from '../reservation/domain/reservation.entity';
import { User } from '../user/domain/user.entity';
import { StudioService } from './application/studio.service';
import { Studio } from './domain/studio.entity';
import { StudioMember } from './domain/studio-member.entity';
import { AppStudioController } from './presentation/app-studio.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Studio, StudioMember, ArtistPage, Reservation, User])],
  controllers: [AppStudioController],
  providers: [StudioService],
  exports: [StudioService],
})
export class StudioModule {}
