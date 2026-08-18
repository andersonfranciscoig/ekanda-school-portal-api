import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { InAppNotificationService } from '../in-app-notification.service';

@Injectable()
export class MarkAllNotificationsAsReadUseCase
  implements UseCase<{ userId: string }, { read: true }>
{
  constructor(private readonly notifications: InAppNotificationService) {}

  async execute(input: { userId: string }): Promise<{ read: true }> {
    return this.notifications.markAllRead(input.userId);
  }
}
