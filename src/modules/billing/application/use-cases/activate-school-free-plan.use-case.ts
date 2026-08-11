import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { SchoolNotFoundException } from '../../../school/domain/exceptions/school.exceptions';
import {
  SCHOOL_REPOSITORY,
  SchoolRepository,
} from '../../../school/domain/repositories/school.repository';
import { SchoolStatus } from '../../../school/domain/school.enums';
import {
  FREE_PLAN_DURATION_DAYS,
  Subscription,
} from '../../domain/aggregates/subscription.aggregate';
import { PlanCode } from '../../domain/entities/plan.entity';
import {
  FreePlanUnavailableException,
  PlanNotFoundException,
} from '../../domain/exceptions/billing.exceptions';
import {
  PLAN_REPOSITORY,
  PlanRepository,
  SUBSCRIPTION_REPOSITORY,
  SubscriptionRepository,
} from '../../domain/repositories/billing.repositories';
import {
  SubscriptionDashboardDto,
  toSubscriptionDashboardDto,
} from '../../domain/services/subscription-access.service';

export type ActivateSchoolFreePlanInput = {
  schoolId: string;
  now?: Date;
};

export type ActivateSchoolFreePlanOutput = {
  schoolId: string;
  schoolStatus: SchoolStatus;
  subscription: SubscriptionDashboardDto;
  created: boolean;
};

@Injectable()
export class ActivateSchoolFreePlanUseCase
  implements
    UseCase<ActivateSchoolFreePlanInput, ActivateSchoolFreePlanOutput>
{
  constructor(
    @Inject(SCHOOL_REPOSITORY)
    private readonly schools: SchoolRepository,
    @Inject(PLAN_REPOSITORY)
    private readonly plans: PlanRepository,
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepository,
  ) {}

  async execute(
    input: ActivateSchoolFreePlanInput,
  ): Promise<ActivateSchoolFreePlanOutput> {
    const now = input.now ?? new Date();
    const school = await this.schools.findById(input.schoolId);
    if (!school) {
      throw new SchoolNotFoundException();
    }

    const freePlan = await this.plans.findByCode(PlanCode.FREE);
    if (!freePlan) {
      throw new PlanNotFoundException('Free plan not found');
    }
    if (!freePlan.isActive) {
      throw new FreePlanUnavailableException();
    }

    const existingFree = await this.subscriptions.findFreeBySchoolId(
      input.schoolId,
    );

    if (existingFree) {
      const changed = existingFree.syncExpiration(now);
      if (changed) {
        await this.subscriptions.save(existingFree);
        if (
          school.status === SchoolStatus.ACTIVE &&
          !existingFree.isValidNow(now)
        ) {
          school.expire();
          await this.schools.save(school);
        }
      }

      return {
        schoolId: school.id,
        schoolStatus: school.status,
        subscription: toSubscriptionDashboardDto(existingFree, freePlan, now),
        created: false,
      };
    }

    const existingValid =
      await this.subscriptions.findValidActiveBySchoolId(input.schoolId);
    if (existingValid) {
      const existingPlan = await this.plans.findById(existingValid.planId);
      if (existingPlan && !existingPlan.isFree()) {
        return {
          schoolId: school.id,
          schoolStatus: school.status,
          subscription: toSubscriptionDashboardDto(
            existingValid,
            existingPlan,
            now,
          ),
          created: false,
        };
      }
    }

    const subscription = Subscription.createFreePlan({
      id: crypto.randomUUID(),
      schoolId: school.id,
      planId: freePlan.id,
      startDate: now,
      durationDays: FREE_PLAN_DURATION_DAYS,
    });

    await this.subscriptions.save(subscription);

    return {
      schoolId: school.id,
      schoolStatus: school.status,
      subscription: toSubscriptionDashboardDto(subscription, freePlan, now),
      created: true,
    };
  }
}
