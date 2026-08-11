import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FavoriteService } from './application/favorite.service';
import { Favorite } from './domain/favorite.entity';
import { AppFavoriteController } from './presentation/app-favorite.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Favorite])],
  controllers: [AppFavoriteController],
  providers: [FavoriteService],
  exports: [FavoriteService],
})
export class FavoriteModule {}
