import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtistPage } from '../artist/domain/artist.entity';
import { Reservation } from '../reservation/domain/reservation.entity';
import { User } from '../user/domain/user.entity';
import { PersonalScheduleService } from './application/personal-schedule.service';
import { StudioService } from './application/studio.service';
import { ArtistPersonalEvent } from './domain/artist-personal-event.entity';
import { Studio } from './domain/studio.entity';
import { StudioMember } from './domain/studio-member.entity';
import { AppPersonalEventController } from './presentation/app-personal-event.controller';
import { AppStudioController } from './presentation/app-studio.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Studio, StudioMember, ArtistPage, Reservation, User, ArtistPersonalEvent,
    ]),
  ],
  controllers: [AppStudioController, AppPersonalEventController],
  providers: [StudioService, PersonalScheduleService],
  exports: [StudioService, PersonalScheduleService],
})
export class StudioModule {}
