import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtistModule } from '../artist/artist.module';
import { ReservationService } from './application/reservation.service';
import { Reservation } from './domain/reservation.entity';
import { User } from '../user/domain/user.entity';
import { ArtistPage } from '../artist/domain/artist.entity';
import { Artwork } from '../artist/domain/artwork.entity';
import { AppReservationController } from './presentation/app-reservation.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Reservation, User, ArtistPage, Artwork]), ArtistModule],
  controllers: [AppReservationController],
  providers: [ReservationService],
  exports: [ReservationService],
})
export class ReservationModule {}
