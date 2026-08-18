import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { InAppNotificationService } from '../in-app-notification.service';

export type MarkNotificationAsReadInput = {
  id: string;
  userId: string;
};

@Injectable()
export class MarkNotificationAsReadUseCase
  implements UseCase<MarkNotificationAsReadInput, { read: true }>
{
  constructor(private readonly notifications: InAppNotificationService) {}

  async execute(input: MarkNotificationAsReadInput): Promise<{ read: true }> {
    return this.notifications.markRead(input.id, input.userId);
  }
}
