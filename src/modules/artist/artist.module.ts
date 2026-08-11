import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtistService } from './application/artist.service';
import { ArtistPage } from './domain/artist.entity';
import { Artwork } from './domain/artwork.entity';
import { AdminArtistController } from './presentation/admin-artist.controller';
import { AppArtistController } from './presentation/app-artist.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ArtistPage, Artwork])],
  controllers: [AppArtistController, AdminArtistController],
  providers: [ArtistService],
  exports: [ArtistService],
})
export class ArtistModule {}
