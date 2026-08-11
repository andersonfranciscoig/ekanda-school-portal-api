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

export type ConfirmPaymentInput = {
  paymentId: string;
  externalTransactionId?: string;
  actorUserId?: string | null;
};

@Injectable()
export class ConfirmPaymentUseCase
  implements UseCase<ConfirmPaymentInput, unknown>
{
  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly payments: PaymentRepository,
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepository,
    @Inject(PLAN_REPOSITORY)
    private readonly plans: PlanRepository,
    private readonly confirmPayment: ConfirmSubscriptionPaymentService,
  ) {}

  async execute(input: ConfirmPaymentInput) {
    const payment = await this.payments.findById(input.paymentId);
    if (!payment) throw new PaymentNotFoundException();
    if (!payment.subscriptionId) throw new SubscriptionNotFoundException();

    const subscription = await this.subscriptions.findById(
      payment.subscriptionId,
    );
    if (!subscription) throw new SubscriptionNotFoundException();

    const plan = await this.plans.findById(payment.planId ?? subscription.planId);
    if (!plan) throw new PlanNotFoundException();

    const confirmed = await this.confirmPayment.confirm({
      payment,
      subscription,
      plan,
      actorUserId: input.actorUserId,
      externalTransactionId:
        input.externalTransactionId ??
        payment.externalTransactionId ??
        `EXP-${payment.id}`,
    });

    return {
      payment: presentPayment(confirmed.payment),
      subscription: presentSubscription(confirmed.subscription, plan),
      alreadyProcessed: confirmed.alreadyProcessed,
    };
  }
}
