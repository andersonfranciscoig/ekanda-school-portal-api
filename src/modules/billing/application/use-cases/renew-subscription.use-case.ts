import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { SchoolAccessAuthorizer } from '../../../school/application/services/school-access.authorizer';
import { Payment } from '../../domain/aggregates/payment.aggregate';
import { PlanCode } from '../../domain/entities/plan.entity';
import {
  InvalidExpressPhoneException,
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
import {
  isValidExpressPhone,
  normalizeExpressPhone,
} from '../../domain/services/billing-period';
import { ConfirmSubscriptionPaymentService } from '../services/confirm-subscription-payment.service';
import {
  presentPayment,
  presentSubscription,
} from '../../infrastructure/http/billing.presenter';

export type RenewSubscriptionInput = {
  actorUserId: string;
  subscriptionId: string;
  expressPhone: string;
};

@Injectable()
export class RenewSubscriptionUseCase
  implements UseCase<RenewSubscriptionInput, unknown>
{
  constructor(
    private readonly access: SchoolAccessAuthorizer,
    @Inject(PLAN_REPOSITORY)
    private readonly plans: PlanRepository,
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepository,
    @Inject(PAYMENT_REPOSITORY)
    private readonly payments: PaymentRepository,
    private readonly confirmPayment: ConfirmSubscriptionPaymentService,
  ) {}

  async execute(input: RenewSubscriptionInput) {
    const subscription = await this.subscriptions.findById(input.subscriptionId);
    if (!subscription) throw new SubscriptionNotFoundException();
    await this.access.assertCanManageSchool(
      input.actorUserId,
      subscription.schoolId,
    );

    const plan = await this.plans.findById(subscription.planId);
    if (!plan || !plan.isActive) throw new PlanNotFoundException();
    if (plan.code === PlanCode.FREE) {
      throw new PlanNotFoundException('O plano FREE não é renovável por pagamento');
    }
    if (!isValidExpressPhone(input.expressPhone)) {
      throw new InvalidExpressPhoneException();
    }

    const payment = Payment.create({
      id: crypto.randomUUID(),
      schoolId: subscription.schoolId,
      subscriptionId: subscription.id,
      planId: plan.id,
      amount: plan.price,
      method: 'MULTICAIXA_EXPRESS',
      expressPhone: normalizeExpressPhone(input.expressPhone),
      externalReference: `renew:${subscription.id}:${crypto.randomUUID()}`,
      metadata: { action: 'renew', simulatedGateway: true },
    });
    payment.markProcessing();
    await this.payments.save(payment);

    const confirmed = await this.confirmPayment.confirm({
      payment,
      subscription,
      plan,
      actorUserId: input.actorUserId,
      externalTransactionId: `EXP-${payment.id}`,
    });

    return {
      subscription: presentSubscription(confirmed.subscription, plan),
      payment: presentPayment(confirmed.payment),
    };
  }
}
