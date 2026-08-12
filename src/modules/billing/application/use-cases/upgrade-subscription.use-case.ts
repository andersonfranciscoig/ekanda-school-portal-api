import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { SubscriptionNotFoundException } from '../../domain/exceptions/billing.exceptions';
import {
  SUBSCRIPTION_REPOSITORY,
  SubscriptionRepository,
} from '../../domain/repositories/billing.repositories';
import {
  InitiatePaymentCheckoutUseCase,
} from './initiate-payment-checkout.use-case';
import { GatewayPaymentMethod } from '../ports/payment-gateway.port';

export type UpgradeSubscriptionInput = {
  actorUserId: string;
  subscriptionId: string;
  planId: string;
  method: GatewayPaymentMethod;
  expressPhone?: string;
};

@Injectable()
export class UpgradeSubscriptionUseCase
  implements UseCase<UpgradeSubscriptionInput, unknown>
{
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepository,
    private readonly checkout: InitiatePaymentCheckoutUseCase,
  ) {}

  async execute(input: UpgradeSubscriptionInput) {
    const subscription = await this.subscriptions.findById(input.subscriptionId);
    if (!subscription) throw new SubscriptionNotFoundException();

    return this.checkout.execute({
      actorUserId: input.actorUserId,
      schoolId: subscription.schoolId,
      planId: input.planId,
      subscriptionId: subscription.id,
      method: input.method,
      expressPhone: input.expressPhone,
      action: 'upgrade',
    });
  }
}
