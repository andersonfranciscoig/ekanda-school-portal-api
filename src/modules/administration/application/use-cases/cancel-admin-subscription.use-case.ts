import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { SubscriptionNotFoundException } from '../../../billing/domain/exceptions/billing.exceptions';
import {
  SUBSCRIPTION_REPOSITORY,
  SubscriptionRepository,
} from '../../../billing/domain/repositories/billing.repositories';
import { presentAdminSubscription } from '../services/admin.presenter';

@Injectable()
export class CancelAdminSubscriptionUseCase
  implements UseCase<{ subscriptionId: string }, unknown>
{
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: { subscriptionId: string }) {
    const subscription = await this.subscriptions.findById(input.subscriptionId);
    if (!subscription) throw new SubscriptionNotFoundException();

    subscription.scheduleCancelAtPeriodEnd();
    await this.subscriptions.save(subscription);

    const row = await this.prisma.subscription.findUniqueOrThrow({
      where: { id: subscription.id },
      include: {
        school: { select: { id: true, name: true, slug: true } },
        plan: {
          select: {
            id: true,
            code: true,
            name: true,
            price: true,
            currency: true,
          },
        },
      },
    });
    return presentAdminSubscription(row);
  }
}
