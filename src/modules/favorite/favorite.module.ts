import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FavoriteService } from './application/favorite.service';
import { Favorite } from './domain/favorite.entity';
import { Artwork } from '../artist/domain/artwork.entity';
import { ArtistPage } from '../artist/domain/artist.entity';
import { Product } from '../supply/domain/supply.entity';
import { ShopPost } from '../shop/domain/shop-post.entity';
import { AppFavoriteController } from './presentation/app-favorite.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Favorite, Artwork, ArtistPage, Product, ShopPost])],
  controllers: [AppFavoriteController],
  providers: [FavoriteService],
  exports: [FavoriteService],
})
export class FavoriteModule {}
