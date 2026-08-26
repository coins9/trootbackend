import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationModule } from '../notification/notification.module';
import { ShopService } from './application/shop.service';
import { ShopApplication, ShopPost } from './domain/shop-post.entity';
import { AdminShopController } from './presentation/admin-shop.controller';
import { AppShopController } from './presentation/app-shop.controller';
import { User } from '../user/domain/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ShopPost, ShopApplication, User]), NotificationModule],
  controllers: [AppShopController, AdminShopController],
  providers: [ShopService],
  exports: [ShopService],
})
export class ShopModule {}
