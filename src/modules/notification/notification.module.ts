import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FirebaseModule } from '../../shared/firebase/firebase.module';
import { User } from '../user/domain/user.entity';
import { NotificationService } from './application/notification.service';
import { NotificationPreference, UserNotification, UserPushToken } from './domain/notification.entity';
import { AppNotificationController } from './presentation/app-notification.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserNotification, NotificationPreference, UserPushToken, User]), FirebaseModule],
  controllers: [AppNotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
