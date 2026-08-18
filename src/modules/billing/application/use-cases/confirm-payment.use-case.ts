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
import { MailService } from '../../../mail/application/mail.service';
import { MailRecipientsService } from '../../../mail/application/mail-recipients.service';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { InAppNotificationService } from '../../../notification/application/in-app-notification.service';
import { NotificationType } from '@prisma/client';
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
    private readonly mail: MailService,
    private readonly recipients: MailRecipientsService,
    private readonly prisma: PrismaService,
    private readonly notifications: InAppNotificationService,
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

    if (!confirmed.alreadyProcessed) {
      const school = await this.prisma.school.findUnique({
        where: { id: confirmed.payment.schoolId },
        select: { id: true, name: true },
      });
      const owner = school
        ? await this.recipients.schoolOwner(school.id)
        : null;
      if (owner && school) {
        const amount = confirmed.payment.amount?.amount ?? 0;
        this.mail.sendPaymentConfirmed({
          email: owner.email,
          ownerName: owner.name,
          schoolName: school.name,
          planName: plan.name,
          amountLabel: `${amount.toLocaleString('pt-AO')} Kz`,
        });
        await this.notifications.notifyEkandaAdmins({
          type: NotificationType.PAYMENT,
          audience: 'admin',
          source: 'pagamento',
          title: 'Pagamento confirmado',
          message: `${school.name} pagou o plano ${plan.name}.`,
          href: '/portal-ops-7f3a/pagamentos',
          metadata: {
            schoolId: school.id,
            paymentId: confirmed.payment.id,
          },
        });
      }
    }

    return {
      payment: presentPayment(confirmed.payment),
      subscription: presentSubscription(confirmed.subscription, plan),
      alreadyProcessed: confirmed.alreadyProcessed,
    };
  }
}
