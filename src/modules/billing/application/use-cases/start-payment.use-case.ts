import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { SchoolAccessAuthorizer } from '../../../school/application/services/school-access.authorizer';
import { Payment } from '../../domain/aggregates/payment.aggregate';
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

export type StartPaymentInput = {
  actorUserId: string;
  schoolId: string;
  planId: string;
  subscriptionId?: string;
  expressPhone: string;
};

@Injectable()
export class StartPaymentUseCase implements UseCase<StartPaymentInput, unknown> {
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

  async execute(input: StartPaymentInput) {
    await this.access.assertCanManageSchool(input.actorUserId, input.schoolId);
    if (!isValidExpressPhone(input.expressPhone)) {
      throw new InvalidExpressPhoneException();
    }

    const plan = await this.plans.findById(input.planId);
    if (!plan || !plan.isActive) throw new PlanNotFoundException();

    const subscription = input.subscriptionId
      ? await this.subscriptions.findById(input.subscriptionId)
      : await this.subscriptions.findLatestBySchoolId(input.schoolId);
    if (!subscription || subscription.schoolId !== input.schoolId) {
      throw new SubscriptionNotFoundException();
    }

    const payment = Payment.create({
      id: crypto.randomUUID(),
      schoolId: input.schoolId,
      subscriptionId: subscription.id,
      planId: plan.id,
      amount: plan.price,
      method: 'MULTICAIXA_EXPRESS',
      expressPhone: normalizeExpressPhone(input.expressPhone),
      externalReference: `pay:${crypto.randomUUID()}`,
      metadata: { simulatedGateway: true },
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
      payment: presentPayment(confirmed.payment),
      subscription: presentSubscription(confirmed.subscription, plan),
    };
  }
}
