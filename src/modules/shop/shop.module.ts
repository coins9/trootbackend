import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShopService } from './application/shop.service';
import { ShopApplication, ShopPost } from './domain/shop-post.entity';
import { AdminShopController } from './presentation/admin-shop.controller';
import { AppShopController } from './presentation/app-shop.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ShopPost, ShopApplication])],
  controllers: [AppShopController, AdminShopController],
  providers: [ShopService],
  exports: [ShopService],
})
export class ShopModule {}
