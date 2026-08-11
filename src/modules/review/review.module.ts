import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtistModule } from '../artist/artist.module';
import { Reservation } from '../reservation/domain/reservation.entity';
import { ReviewService } from './application/review.service';
import { Review } from './domain/review.entity';
import { AppReviewController } from './presentation/app-review.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Review, Reservation]), ArtistModule],
  controllers: [AppReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
