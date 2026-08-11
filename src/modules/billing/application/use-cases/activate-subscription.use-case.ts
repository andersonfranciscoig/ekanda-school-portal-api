import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  PaymentNotFoundException,
  PlanNotFoundException,
  SubscriptionNotFoundException,
} from '../../domain/exceptions/billing.exceptions';
import {
  PAYMENT_REPOSITORY,
  PaymentRepository,
  PLAN_REPOSITORY,
  PlanRepository,
  SUBSCRIPTION_REPOSITORY,
  SubscriptionRepository,
} from '../../domain/repositories/billing.repositories';
import { ConfirmSubscriptionPaymentService } from '../services/confirm-subscription-payment.service';
import {
  presentPayment,
  presentSubscription,
} from '../../infrastructure/http/billing.presenter';

export type ActivateSubscriptionInput = {
  subscriptionId: string;
  paymentId: string;
  actorUserId?: string | null;
};

@Injectable()
export class ActivateSubscriptionUseCase
  implements UseCase<ActivateSubscriptionInput, unknown>
{
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepository,
    @Inject(PAYMENT_REPOSITORY)
    private readonly payments: PaymentRepository,
    @Inject(PLAN_REPOSITORY)
    private readonly plans: PlanRepository,
    private readonly confirmPayment: ConfirmSubscriptionPaymentService,
  ) {}

  async execute(input: ActivateSubscriptionInput) {
    const subscription = await this.subscriptions.findById(input.subscriptionId);
    if (!subscription) throw new SubscriptionNotFoundException();
    const payment = await this.payments.findById(input.paymentId);
    if (!payment || payment.subscriptionId !== subscription.id) {
      throw new PaymentNotFoundException();
    }
    const plan = await this.plans.findById(subscription.planId);
    if (!plan) throw new PlanNotFoundException();

    const confirmed = await this.confirmPayment.confirm({
      payment,
      subscription,
      plan,
      actorUserId: input.actorUserId,
      externalTransactionId:
        payment.externalTransactionId ?? `EXP-${payment.id}`,
    });

    return {
      subscription: presentSubscription(confirmed.subscription, plan),
      payment: presentPayment(confirmed.payment),
    };
  }
}
