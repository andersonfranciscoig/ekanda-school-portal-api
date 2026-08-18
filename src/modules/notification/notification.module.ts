import { Global, Module } from '@nestjs/common';
import { InAppNotificationService } from './application/in-app-notification.service';
import { NotificationsController } from './infrastructure/http/controllers/notifications.controller';
import * as UseCases from './application/use-cases';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [InAppNotificationService, ...Object.values(UseCases)],
  exports: [InAppNotificationService],
})
export class NotificationModule {}
