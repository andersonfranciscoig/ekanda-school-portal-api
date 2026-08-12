import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { SchoolAccessAuthorizer } from '../../../school/application/services/school-access.authorizer';
import { SchoolEntitlementService } from '../services/school-entitlement.service';
import {
  PLAN_REPOSITORY,
  PlanRepository,
  SUBSCRIPTION_REPOSITORY,
  SubscriptionRepository,
} from '../../domain/repositories/billing.repositories';
import { presentPlan, presentSubscription } from '../../infrastructure/http/billing.presenter';

export type GetCurrentSubscriptionInput = {
  actorUserId: string;
  schoolId: string;
};

@Injectable()
export class GetCurrentSubscriptionUseCase
  implements UseCase<GetCurrentSubscriptionInput, unknown>
{
  constructor(
    private readonly access: SchoolAccessAuthorizer,
    private readonly entitlements: SchoolEntitlementService,
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepository,
    @Inject(PLAN_REPOSITORY)
    private readonly plans: PlanRepository,
  ) {}

  async execute(input: GetCurrentSubscriptionInput) {
    await this.access.assertCanManageSchool(input.actorUserId, input.schoolId);
    await this.entitlements.getDashboardSubscription(input.schoolId);

    const latest = await this.subscriptions.findLatestBySchoolId(input.schoolId);
    if (!latest) return null;
    const plan = await this.plans.findById(latest.planId);
    if (!plan) return null;
    return {
      subscription: presentSubscription(latest, plan),
      plan: presentPlan(plan),
    };
  }
}
