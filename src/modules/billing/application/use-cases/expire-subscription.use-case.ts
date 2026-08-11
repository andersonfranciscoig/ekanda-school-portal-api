import { Inject, Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { UseCase } from '../../../../shared/application/use-case';
import { AUDIT_LOGGER } from '../../../../shared/application/ports/audit-logger.port';
import type { AuditLogger } from '../../../../shared/application/ports/audit-logger.port';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { SchoolStatus } from '../../../school/domain/school.enums';
import {
  SCHOOL_REPOSITORY,
  SchoolRepository,
} from '../../../school/domain/repositories/school.repository';
import {
  SUBSCRIPTION_REPOSITORY,
  SubscriptionRepository,
} from '../../domain/repositories/billing.repositories';

export type ExpireDueSubscriptionsInput = {
  now?: Date;
};

@Injectable()
export class ExpireSubscriptionUseCase
  implements UseCase<ExpireDueSubscriptionsInput, { expired: number }>
{
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepository,
    @Inject(SCHOOL_REPOSITORY)
    private readonly schools: SchoolRepository,
    @Inject(AUDIT_LOGGER)
    private readonly audit: AuditLogger,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: ExpireDueSubscriptionsInput = {}) {
    const now = input.now ?? new Date();
    const due = await this.subscriptions.findDueForExpiration(now);
    let expired = 0;

    for (const subscription of due) {
      const changed = subscription.syncExpiration(now);
      if (!changed) continue;
      await this.subscriptions.save(subscription);
      expired += 1;

      const stillValid = await this.subscriptions.findValidActiveBySchoolId(
        subscription.schoolId,
      );
      if (!stillValid) {
        const school = await this.schools.findById(subscription.schoolId);
        if (school?.status === SchoolStatus.ACTIVE) {
          school.expire();
          await this.schools.save(school);
        }
      }

      await this.audit.log({
        action: 'SUBSCRIPTION_EXPIRED',
        entity: 'Subscription',
        entityId: subscription.id,
        newData: { schoolId: subscription.schoolId },
      });

      const memberships = await this.prisma.schoolMembership.findMany({
        where: { schoolId: subscription.schoolId, status: 'ACTIVE' },
        select: { userId: true },
      });
      if (memberships.length > 0) {
        await this.prisma.notification.createMany({
          data: memberships.map((item) => ({
            id: crypto.randomUUID(),
            userId: item.userId,
            type: NotificationType.SUBSCRIPTION,
            title: 'Subscrição expirada',
            message:
              'A subscrição Ekanda expirou. Renove o plano para voltar a receber candidaturas e funcionalidades pagas.',
            metadata: { subscriptionId: subscription.id },
          })),
        });
      }
    }

    return { expired };
  }
}
