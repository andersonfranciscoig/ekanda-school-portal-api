import { Module } from '@nestjs/common';
import { GestaoRolloutModule } from '../gestao-rollout/gestao-rollout.module';
import { NotificationsController } from './infrastructure/http/controllers/notifications.controller';
import * as UseCases from './application/use-cases';

@Module({
  imports: [GestaoRolloutModule],
  controllers: [NotificationsController],
  providers: [...Object.values(UseCases)],
})
export class NotificationModule {}
