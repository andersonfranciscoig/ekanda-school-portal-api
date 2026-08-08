import { Module } from '@nestjs/common';
import { NotificationsController } from './infrastructure/http/controllers/notifications.controller';
import * as UseCases from './application/use-cases';

@Module({
  controllers: [NotificationsController],
  providers: [...Object.values(UseCases)],
})
export class NotificationModule {}
