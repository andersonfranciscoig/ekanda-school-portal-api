import { Inject, Injectable } from '@nestjs/common';
import {
  SCHOOL_REPOSITORY,
  SchoolRepository,
} from '../../../school/domain/repositories/school.repository';
import { SchoolStatus } from '../../../school/domain/school.enums';
import {
  PLAN_REPOSITORY,
  PlanRepository,
  SUBSCRIPTION_REPOSITORY,
  SubscriptionRepository,
} from '../../domain/repositories/billing.repositories';
import {
  canAccessFeature,
  canShowPublicProfile,
  SubscriptionDashboardDto,
  toSubscriptionDashboardDto,
} from '../../domain/services/subscription-access.service';

/**
 * Regra centralizada de entitlements / visibilidade pública.
 * Controllers não devem comparar planCode directamente.
 */
@Injectable()
export class SchoolEntitlementService {
  constructor(
    @Inject(SCHOOL_REPOSITORY)
    private readonly schools: SchoolRepository,
    @Inject(PLAN_REPOSITORY)
    private readonly plans: PlanRepository,
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepository,
  ) {}

  async canAccess(schoolId: string, featureCode: string, now = new Date()) {
    const ctx = await this.loadContext(schoolId, now);
    return canAccessFeature({
      subscription: ctx.subscription,
      plan: ctx.plan,
      featureCode,
      now,
    });
  }

  async isPublicProfileVisible(schoolId: string, now = new Date()) {
    const school = await this.schools.findById(schoolId);
    if (!school) return false;
    const ctx = await this.loadContext(schoolId, now);
    return canShowPublicProfile({
      schoolStatus: school.status,
      subscription: ctx.subscription,
      plan: ctx.plan,
      now,
    });
  }

  async getDashboardSubscription(
    schoolId: string,
    now = new Date(),
  ): Promise<SubscriptionDashboardDto | null> {
    const subscription =
      await this.subscriptions.findLatestBySchoolId(schoolId);
    if (!subscription) return null;

    const plan = await this.plans.findById(subscription.planId);
    if (!plan) return null;

    const changed = subscription.syncExpiration(now);
    if (changed) {
      await this.subscriptions.save(subscription);
      const school = await this.schools.findById(schoolId);
      if (school?.status === SchoolStatus.ACTIVE) {
        school.expire();
        await this.schools.save(school);
      }
    }

    return toSubscriptionDashboardDto(subscription, plan, now);
  }

  private async loadContext(schoolId: string, now: Date) {
    let subscription =
      await this.subscriptions.findValidActiveBySchoolId(schoolId);

    if (!subscription) {
      const latest = await this.subscriptions.findLatestBySchoolId(schoolId);
      if (latest) {
        const changed = latest.syncExpiration(now);
        if (changed) {
          await this.subscriptions.save(latest);
          const school = await this.schools.findById(schoolId);
          if (school?.status === SchoolStatus.ACTIVE) {
            school.expire();
            await this.schools.save(school);
          }
        }
      }
      return { subscription: null, plan: null };
    }

    const changed = subscription.syncExpiration(now);
    if (changed) {
      await this.subscriptions.save(subscription);
      const school = await this.schools.findById(schoolId);
      if (school?.status === SchoolStatus.ACTIVE) {
        school.expire();
        await this.schools.save(school);
      }
      return { subscription: null, plan: null };
    }

    const plan = await this.plans.findById(subscription.planId);
    return { subscription, plan };
  }
}
