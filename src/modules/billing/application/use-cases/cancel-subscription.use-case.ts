import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { AUDIT_LOGGER } from '../../../../shared/application/ports/audit-logger.port';
import type { AuditLogger } from '../../../../shared/application/ports/audit-logger.port';
import { SchoolAccessAuthorizer } from '../../../school/application/services/school-access.authorizer';
import { SubscriptionNotFoundException } from '../../domain/exceptions/billing.exceptions';
import {
  PLAN_REPOSITORY,
  PlanRepository,
  SUBSCRIPTION_REPOSITORY,
  SubscriptionRepository,
} from '../../domain/repositories/billing.repositories';
import { presentSubscription } from '../../infrastructure/http/billing.presenter';

export type CancelSubscriptionInput = {
  actorUserId: string;
  subscriptionId: string;
};

@Injectable()
export class CancelSubscriptionUseCase
  implements UseCase<CancelSubscriptionInput, unknown>
{
  constructor(
    private readonly access: SchoolAccessAuthorizer,
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepository,
    @Inject(PLAN_REPOSITORY)
    private readonly plans: PlanRepository,
    @Inject(AUDIT_LOGGER)
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: CancelSubscriptionInput) {
    const subscription = await this.subscriptions.findById(input.subscriptionId);
    if (!subscription) throw new SubscriptionNotFoundException();
    await this.access.assertCanManageSchool(
      input.actorUserId,
      subscription.schoolId,
    );

    subscription.scheduleCancelAtPeriodEnd();
    await this.subscriptions.save(subscription);

    await this.audit.log({
      actorUserId: input.actorUserId,
      action: 'SUBSCRIPTION_CANCELLED',
      entity: 'Subscription',
      entityId: subscription.id,
      newData: { cancelAtPeriodEnd: true },
    });

    const plan = await this.plans.findById(subscription.planId);
    if (!plan) throw new SubscriptionNotFoundException();
    return presentSubscription(subscription, plan);
  }
}
