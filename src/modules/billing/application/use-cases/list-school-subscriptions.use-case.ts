import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { SchoolAccessAuthorizer } from '../../../school/application/services/school-access.authorizer';
import {
  PLAN_REPOSITORY,
  PlanRepository,
  SUBSCRIPTION_REPOSITORY,
  SubscriptionRepository,
} from '../../domain/repositories/billing.repositories';
import { presentSubscription } from '../../infrastructure/http/billing.presenter';

export type ListSchoolSubscriptionsInput = {
  actorUserId: string;
  schoolId: string;
};

@Injectable()
export class ListSchoolSubscriptionsUseCase
  implements UseCase<ListSchoolSubscriptionsInput, unknown>
{
  constructor(
    private readonly access: SchoolAccessAuthorizer,
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepository,
    @Inject(PLAN_REPOSITORY)
    private readonly plans: PlanRepository,
  ) {}

  async execute(input: ListSchoolSubscriptionsInput) {
    await this.access.assertCanManageSchool(input.actorUserId, input.schoolId);
    const rows = await this.subscriptions.findManyBySchoolId(input.schoolId);
    const items = [];
    for (const subscription of rows) {
      const plan = await this.plans.findById(subscription.planId);
      if (plan) items.push(presentSubscription(subscription, plan));
    }
    return { items };
  }
}
