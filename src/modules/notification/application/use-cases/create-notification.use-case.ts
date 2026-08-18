import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  CreateInAppNotificationInput,
  InAppNotificationService,
} from '../in-app-notification.service';

@Injectable()
export class CreateNotificationUseCase
  implements UseCase<CreateInAppNotificationInput, void>
{
  constructor(private readonly notifications: InAppNotificationService) {}

  async execute(input: CreateInAppNotificationInput): Promise<void> {
    await this.notifications.create(input);
  }
}
