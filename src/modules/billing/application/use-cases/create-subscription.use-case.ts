import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { SchoolAccessAuthorizer } from '../../../school/application/services/school-access.authorizer';
import { Payment } from '../../domain/aggregates/payment.aggregate';
import { Subscription } from '../../domain/aggregates/subscription.aggregate';
import { PlanCode } from '../../domain/entities/plan.entity';
import {
  InvalidExpressPhoneException,
  PlanNotFoundException,
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

export type CreateSubscriptionInput = {
  actorUserId: string;
  schoolId: string;
  planId: string;
  expressPhone: string;
};

@Injectable()
export class CreateSubscriptionUseCase
  implements UseCase<CreateSubscriptionInput, unknown>
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

  async execute(input: CreateSubscriptionInput) {
    await this.access.assertCanManageSchool(input.actorUserId, input.schoolId);

    const plan = await this.plans.findById(input.planId);
    if (!plan || !plan.isActive) throw new PlanNotFoundException();
    if (plan.code === PlanCode.FREE) {
      throw new PlanNotFoundException(
        'O plano FREE só é activado no onboarding. Escolha um plano pago.',
      );
    }
    if (!isValidExpressPhone(input.expressPhone)) {
      throw new InvalidExpressPhoneException();
    }

    const phone = normalizeExpressPhone(input.expressPhone);
    const current = await this.subscriptions.findValidActiveBySchoolId(
      input.schoolId,
    );

    const subscription =
      current && current.planId === plan.id
        ? current
        : Subscription.createPending({
            id: crypto.randomUUID(),
            schoolId: input.schoolId,
            planId: plan.id,
          });

    if (!current || current.planId !== plan.id) {
      await this.subscriptions.save(subscription);
    }

    const payment = Payment.create({
      id: crypto.randomUUID(),
      schoolId: input.schoolId,
      subscriptionId: subscription.id,
      planId: plan.id,
      amount: plan.price,
      method: 'MULTICAIXA_EXPRESS',
      expressPhone: phone,
      externalReference: `sub:${subscription.id}:pay:${crypto.randomUUID()}`,
      metadata: { channel: 'express', simulatedGateway: true },
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
