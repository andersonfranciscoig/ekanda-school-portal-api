import { Inject, Injectable } from '@nestjs/common';
import {
  NotificationType,
  WalletTransactionCategory,
  WalletTransactionType,
} from '@prisma/client';
import { AUDIT_LOGGER } from '../../../../shared/application/ports/audit-logger.port';
import type { AuditLogger } from '../../../../shared/application/ports/audit-logger.port';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { SchoolStatus } from '../../../school/domain/school.enums';
import {
  SCHOOL_REPOSITORY,
  SchoolRepository,
} from '../../../school/domain/repositories/school.repository';
import { Payment } from '../../domain/aggregates/payment.aggregate';
import { Subscription } from '../../domain/aggregates/subscription.aggregate';
import { Plan } from '../../domain/entities/plan.entity';
import {
  PAYMENT_REPOSITORY,
  PaymentRepository,
  SUBSCRIPTION_REPOSITORY,
  SubscriptionRepository,
} from '../../domain/repositories/billing.repositories';
import { addBillingPeriod } from '../../domain/services/billing-period';
import { WalletLedgerService } from './wallet-ledger.service';

export type ConfirmSubscriptionPaymentResult = {
  payment: Payment;
  subscription: Subscription;
  alreadyProcessed: boolean;
};

@Injectable()
export class ConfirmSubscriptionPaymentService {
  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly payments: PaymentRepository,
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepository,
    @Inject(SCHOOL_REPOSITORY)
    private readonly schools: SchoolRepository,
    private readonly ledger: WalletLedgerService,
    private readonly prisma: PrismaService,
    @Inject(AUDIT_LOGGER)
    private readonly audit: AuditLogger,
  ) {}

  async confirm(params: {
    payment: Payment;
    subscription: Subscription;
    plan: Plan;
    actorUserId?: string | null;
    externalTransactionId: string;
    now?: Date;
  }): Promise<ConfirmSubscriptionPaymentResult> {
    const now = params.now ?? new Date();
    const alreadyPaid = params.payment.isPaid();

    params.payment.confirmFromGateway({
      externalTransactionId: params.externalTransactionId,
      paidAt: now,
    });
    await this.payments.save(params.payment);

    const platform = await this.ledger.ensurePlatformWallet(
      params.payment.amount.currency,
    );
    const schoolWallet = await this.ledger.ensureSchoolWallet(
      params.payment.schoolId,
      params.payment.amount.currency,
    );

    const posted = await this.ledger.post({
      walletId: platform.id,
      type: WalletTransactionType.CREDIT,
      amount: params.payment.amount.amount,
      currency: params.payment.amount.currency,
      description: `Receita de subscrição ${params.plan.code}`,
      reference: `payment:${params.payment.id}:subscription-revenue`,
      category: WalletTransactionCategory.SUBSCRIPTION,
      paymentId: params.payment.id,
      metadata: {
        schoolId: params.payment.schoolId,
        subscriptionId: params.subscription.id,
        planCode: params.plan.code,
      },
    });

    await this.ledger.post({
      walletId: schoolWallet.id,
      type: WalletTransactionType.ADJUSTMENT,
      amount: 0,
      currency: params.payment.amount.currency,
      description: `Pagamento Express registado (${params.plan.code})`,
      reference: `payment:${params.payment.id}:school-receipt`,
      category: WalletTransactionCategory.PAYMENT,
      paymentId: params.payment.id,
      metadata: {
        expressPhone: params.payment.expressPhone,
        amountPaid: params.payment.amount.amount,
      },
    });

    if (alreadyPaid && posted.duplicated) {
      return {
        payment: params.payment,
        subscription: params.subscription,
        alreadyProcessed: true,
      };
    }

    const periodStart =
      params.subscription.isValidNow(now) && params.subscription.endDate
        ? params.subscription.endDate
        : now;
    const periodEnd = addBillingPeriod(periodStart, params.plan.billingPeriod);
    const startDate = params.subscription.startDate ?? now;

    if (
      params.subscription.status === 'ACTIVE' &&
      params.subscription.planId === params.plan.id
    ) {
      params.subscription.renew({
        hasValidPayment: true,
        startDate,
        endDate: periodEnd,
      });
    } else {
      if (params.subscription.planId !== params.plan.id) {
        params.subscription.changePlan(params.plan.id);
      }
      params.subscription.activate({
        planIsActive: params.plan.isActive,
        hasValidPayment: true,
        startDate,
        endDate: periodEnd,
      });
    }

    await this.subscriptions.save(params.subscription);

    const others = await this.subscriptions.findManyBySchoolId(
      params.subscription.schoolId,
    );
    for (const other of others) {
      if (
        other.id !== params.subscription.id &&
        other.status === 'ACTIVE'
      ) {
        other.expire();
        await this.subscriptions.save(other);
      }
    }

    const school = await this.schools.findById(params.subscription.schoolId);
    if (school && school.status !== SchoolStatus.ACTIVE) {
      school.activateAfterPaidSubscription();
      await this.schools.save(school);
    }

    const externalEventId = `confirm:${params.payment.id}:${params.externalTransactionId}`;
    const existingEvent = await this.prisma.paymentEvent.findUnique({
      where: { externalEventId },
    });
    if (!existingEvent) {
      await this.prisma.paymentEvent.create({
        data: {
          id: crypto.randomUUID(),
          paymentId: params.payment.id,
          eventType: 'payment.confirmed',
          externalEventId,
          payload: {
            provider: 'MULTICAIXA_EXPRESS',
            expressPhone: params.payment.expressPhone,
          },
          processed: true,
          processedAt: now,
        },
      });
    }

    await this.audit.log({
      actorUserId: params.actorUserId ?? null,
      action: alreadyPaid ? 'PAYMENT_CONFIRMED' : 'PAYMENT_CONFIRMED',
      entity: 'Payment',
      entityId: params.payment.id,
      newData: {
        status: params.payment.status,
        subscriptionId: params.subscription.id,
        subscriptionStatus: params.subscription.status,
        amount: params.payment.amount.amount,
      },
    });

    await this.notifySchoolOwners({
      schoolId: params.subscription.schoolId,
      title: 'Pagamento confirmado',
      message: `O pagamento do plano ${params.plan.name} foi confirmado. A subscrição está activa.`,
      metadata: {
        paymentId: params.payment.id,
        subscriptionId: params.subscription.id,
      },
    });

    return {
      payment: params.payment,
      subscription: params.subscription,
      alreadyProcessed: false,
    };
  }

  private async notifySchoolOwners(params: {
    schoolId: string;
    title: string;
    message: string;
    metadata: Record<string, unknown>;
  }) {
    const memberships = await this.prisma.schoolMembership.findMany({
      where: { schoolId: params.schoolId, status: 'ACTIVE' },
      select: { userId: true },
    });
    if (memberships.length === 0) return;

    await this.prisma.notification.createMany({
      data: memberships.map((item) => ({
        id: crypto.randomUUID(),
        userId: item.userId,
        type: NotificationType.PAYMENT,
        title: params.title,
        message: params.message,
        metadata: params.metadata as never,
      })),
    });
  }
}
