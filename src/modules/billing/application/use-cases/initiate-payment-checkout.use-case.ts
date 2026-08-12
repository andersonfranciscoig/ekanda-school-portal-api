import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UseCase } from '../../../../shared/application/use-case';
import { SchoolAccessAuthorizer } from '../../../school/application/services/school-access.authorizer';
import {
  SCHOOL_REPOSITORY,
  SchoolRepository,
} from '../../../school/domain/repositories/school.repository';
import { Payment } from '../../domain/aggregates/payment.aggregate';
import { Subscription } from '../../domain/aggregates/subscription.aggregate';
import { PlanCode } from '../../domain/entities/plan.entity';
import {
  InvalidExpressPhoneException,
  InvalidPaymentAmountException,
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
import {
  GatewayPaymentMethod,
  PAYMENT_GATEWAY,
  PaymentGateway,
} from '../ports/payment-gateway.port';
import { ConfirmSubscriptionPaymentService } from '../services/confirm-subscription-payment.service';
import {
  presentCheckout,
  presentPayment,
  presentSubscription,
} from '../../infrastructure/http/billing.presenter';

export type PaymentCheckoutAction = 'subscribe' | 'renew' | 'upgrade';

export type InitiatePaymentCheckoutInput = {
  actorUserId: string;
  schoolId: string;
  planId: string;
  method: GatewayPaymentMethod;
  expressPhone?: string;
  subscriptionId?: string;
  action?: PaymentCheckoutAction;
};

const FINDORA_TEST_PHONE = '923000000';

@Injectable()
export class InitiatePaymentCheckoutUseCase
  implements UseCase<InitiatePaymentCheckoutInput, unknown>
{
  constructor(
    private readonly access: SchoolAccessAuthorizer,
    private readonly config: ConfigService,
    @Inject(PLAN_REPOSITORY)
    private readonly plans: PlanRepository,
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepository,
    @Inject(PAYMENT_REPOSITORY)
    private readonly payments: PaymentRepository,
    @Inject(SCHOOL_REPOSITORY)
    private readonly schools: SchoolRepository,
    @Inject(PAYMENT_GATEWAY)
    private readonly gateway: PaymentGateway,
    private readonly confirmPayment: ConfirmSubscriptionPaymentService,
  ) {}

  async execute(input: InitiatePaymentCheckoutInput) {
    await this.access.assertCanManageSchool(input.actorUserId, input.schoolId);

    const action = input.action ?? 'subscribe';
    const isFindoraTest =
      this.config.get<string>('PAYMENT_GATEWAY', 'simulated') === 'findora_test';

    let expressPhone: string | null = null;
    if (input.method === 'MULTICAIXA_EXPRESS') {
      if (isFindoraTest) {
        expressPhone = FINDORA_TEST_PHONE;
      } else {
        if (!input.expressPhone || !isValidExpressPhone(input.expressPhone)) {
          throw new InvalidExpressPhoneException();
        }
        expressPhone = normalizeExpressPhone(input.expressPhone);
      }
    }

    const plan = await this.plans.findById(input.planId);
    if (!plan || !plan.isActive) throw new PlanNotFoundException();
    if (plan.code === PlanCode.FREE) {
      throw new PlanNotFoundException(
        'O plano FREE só é activado no onboarding.',
      );
    }
    if (plan.price.amount <= 0) {
      throw new InvalidPaymentAmountException();
    }

    const school = await this.schools.findById(input.schoolId);
    const schoolName = school?.name?.trim() || 'Colégio';

    const subscription = await this.resolveSubscription(input, action, plan.id);

    const payment = Payment.create({
      id: crypto.randomUUID(),
      schoolId: input.schoolId,
      subscriptionId: subscription.id,
      planId: plan.id,
      amount: plan.price,
      method: input.method,
      expressPhone,
      externalReference: `${action}:${subscription.id}:${crypto.randomUUID()}`,
      metadata: {
        action,
        channel: input.method === 'MULTICAIXA_EXPRESS' ? 'express' : 'bank',
        schoolName,
        ...(isFindoraTest && input.expressPhone
          ? { requestedExpressPhone: input.expressPhone }
          : {}),
      },
    });

    await this.payments.save(payment);

    const frontendUrl = this.config
      .get<string>('FRONTEND_URL', 'http://localhost:3000')
      .replace(/\/$/, '');

    const gatewayResult = await this.gateway.initiateCheckout({
      paymentId: payment.id,
      amount: plan.price.amount,
      currency: plan.price.currency,
      description: `Subscrição do plano ${plan.name} do ${schoolName}`,
      method: input.method,
      expressPhone: expressPhone ?? undefined,
      successUrl: `${frontendUrl}/pagamentos/sucesso?paymentId=${payment.id}`,
      cancelUrl: `${frontendUrl}/pagamentos/cancelado?paymentId=${payment.id}`,
    });

    payment.attachGatewayMetadata({
      gateway: {
        provider: gatewayResult.provider,
        invoiceId: gatewayResult.invoiceId,
        checkoutSessionId: gatewayResult.checkoutSessionId,
        paymentIntentId: gatewayResult.paymentIntentId,
        bankReference: gatewayResult.bankReference,
        bankEntity: gatewayResult.bankEntity,
        bankAmount: gatewayResult.bankAmount,
      },
    });
    payment.markProcessing();
    await this.payments.save(payment);

    if (this.gateway.providerName === 'simulated') {
      const confirmed = await this.confirmPayment.confirm({
        payment,
        subscription,
        plan,
        actorUserId: input.actorUserId,
        externalTransactionId:
          gatewayResult.paymentIntentId ??
          `SIM-${gatewayResult.checkoutSessionId}`,
      });

      return {
        payment: presentPayment(confirmed.payment),
        subscription: presentSubscription(confirmed.subscription, plan),
        checkout: presentCheckout(gatewayResult, confirmed.payment.status),
      };
    }

    return {
      payment: presentPayment(payment),
      subscription: presentSubscription(subscription, plan),
      checkout: presentCheckout(gatewayResult, payment.status),
    };
  }

  private async resolveSubscription(
    input: InitiatePaymentCheckoutInput,
    action: PaymentCheckoutAction,
    planId: string,
  ): Promise<Subscription> {
    if (action === 'renew' || action === 'upgrade') {
      if (!input.subscriptionId) {
        throw new SubscriptionNotFoundException();
      }
      const subscription = await this.subscriptions.findById(
        input.subscriptionId,
      );
      if (!subscription || subscription.schoolId !== input.schoolId) {
        throw new SubscriptionNotFoundException();
      }
      if (action === 'upgrade') {
        subscription.changePlan(planId);
      }
      return subscription;
    }

    const current = await this.subscriptions.findValidActiveBySchoolId(
      input.schoolId,
    );
    if (current && current.planId === planId) {
      return current;
    }

    const subscription = Subscription.createPending({
      id: crypto.randomUUID(),
      schoolId: input.schoolId,
      planId,
    });
    await this.subscriptions.save(subscription);
    return subscription;
  }
}
