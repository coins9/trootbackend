import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtistModule } from '../artist/artist.module';
import { Reservation } from '../reservation/domain/reservation.entity';
import { ReviewService } from './application/review.service';
import { Review } from './domain/review.entity';
import { ArtistPage } from '../artist/domain/artist.entity';
import { User } from '../user/domain/user.entity';
import { AppReviewController } from './presentation/app-review.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Review, Reservation, ArtistPage, User]), ArtistModule],
  controllers: [AppReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
