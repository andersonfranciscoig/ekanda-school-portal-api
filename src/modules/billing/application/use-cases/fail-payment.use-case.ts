import { Inject, Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { UseCase } from '../../../../shared/application/use-case';
import { AUDIT_LOGGER } from '../../../../shared/application/ports/audit-logger.port';
import type { AuditLogger } from '../../../../shared/application/ports/audit-logger.port';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { PaymentNotFoundException } from '../../domain/exceptions/billing.exceptions';
import {
  PAYMENT_REPOSITORY,
  PaymentRepository,
} from '../../domain/repositories/billing.repositories';
import { presentPayment } from '../../infrastructure/http/billing.presenter';

export type FailPaymentInput = {
  paymentId: string;
  reason?: string;
  actorUserId?: string | null;
};

@Injectable()
export class FailPaymentUseCase implements UseCase<FailPaymentInput, unknown> {
  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly payments: PaymentRepository,
    @Inject(AUDIT_LOGGER)
    private readonly audit: AuditLogger,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: FailPaymentInput) {
    const payment = await this.payments.findById(input.paymentId);
    if (!payment) throw new PaymentNotFoundException();
    payment.fail(input.reason);
    await this.payments.save(payment);

    await this.audit.log({
      actorUserId: input.actorUserId ?? null,
      action: 'PAYMENT_FAILED',
      entity: 'Payment',
      entityId: payment.id,
      newData: { reason: input.reason ?? null },
    });

    const memberships = await this.prisma.schoolMembership.findMany({
      where: { schoolId: payment.schoolId, status: 'ACTIVE' },
      select: { userId: true },
    });
    if (memberships.length > 0) {
      await this.prisma.notification.createMany({
        data: memberships.map((item) => ({
          id: crypto.randomUUID(),
          userId: item.userId,
          type: NotificationType.PAYMENT,
          title: 'Pagamento falhou',
          message:
            input.reason ??
            'O pagamento Multicaixa Express não foi concluído.',
          metadata: { paymentId: payment.id, audience: 'school', source: 'pagamento', href: '/dashboard/pagamentos' },
        })),
      });
    }

    return presentPayment(payment);
  }
}
