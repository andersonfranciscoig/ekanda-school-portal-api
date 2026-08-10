import { Money } from '../../../../shared/domain/value-objects/money.vo';
import {
  FREE_PLAN_DURATION_DAYS,
  Subscription,
  SubscriptionStatus,
} from '../aggregates/subscription.aggregate';
import { Plan, PlanCode } from '../entities/plan.entity';
import { PlanFeatureCode } from '../plan-feature-codes';
import {
  canAccessFeature,
  canShowPublicProfile,
  evaluateSubscriptionValidity,
  toSubscriptionDashboardDto,
} from './subscription-access.service';

describe('subscription-access domain rules', () => {
  const start = new Date('2026-08-10T10:00:00.000Z');
  const end = new Date('2026-09-09T10:00:00.000Z');

  const freePlan = Plan.rehydrate({
    id: 'plan-free',
    code: PlanCode.FREE,
    name: 'Plano Gratuito',
    description: null,
    price: Money.create(0, 'AOA'),
    billingPeriod: 'ONE_TIME',
    isActive: true,
    isPublic: true,
    featureCodes: [PlanFeatureCode.PUBLIC_PROFILE],
  });

  const presencePlan = Plan.rehydrate({
    id: 'plan-presence',
    code: PlanCode.PRESENCE,
    name: 'Presença',
    description: null,
    price: Money.create(0, 'Kz'),
    billingPeriod: 'MONTHLY',
    isActive: true,
    isPublic: true,
    featureCodes: [
      PlanFeatureCode.PUBLIC_PROFILE,
      PlanFeatureCode.MANAGE_APPLICATIONS,
    ],
  });

  function freeSub(overrides?: Partial<{
    status: SubscriptionStatus;
    startDate: Date;
    endDate: Date;
  }>) {
    return Subscription.rehydrate({
      id: 'sub-1',
      schoolId: 'school-1',
      planId: freePlan.id,
      status: overrides?.status ?? SubscriptionStatus.ACTIVE,
      startDate: overrides?.startDate ?? start,
      endDate: overrides?.endDate ?? end,
      autoRenew: false,
    });
  }

  it('FREE válido → PUBLIC_PROFILE true', () => {
    const sub = freeSub();
    const now = new Date('2026-08-20T10:00:00.000Z');
    expect(
      canAccessFeature({
        subscription: sub,
        plan: freePlan,
        featureCode: PlanFeatureCode.PUBLIC_PROFILE,
        now,
      }),
    ).toBe(true);
    expect(
      canAccessFeature({
        subscription: sub,
        plan: freePlan,
        featureCode: PlanFeatureCode.APPLICATIONS_MANAGEMENT,
        now,
      }),
    ).toBe(false);
    expect(
      canShowPublicProfile({
        schoolStatus: 'ACTIVE',
        subscription: sub,
        plan: freePlan,
        now,
      }),
    ).toBe(true);
  });

  it('FREE expirado por data → PUBLIC_PROFILE false + status efectivo EXPIRED', () => {
    const sub = freeSub();
    const now = new Date('2026-09-10T10:00:00.000Z');
    expect(sub.isValidNow(now)).toBe(false);
    expect(evaluateSubscriptionValidity(sub, now)).toMatchObject({
      status: SubscriptionStatus.EXPIRED,
      isExpired: true,
      daysRemaining: 0,
      isValid: false,
    });
    expect(
      canAccessFeature({
        subscription: sub,
        plan: freePlan,
        featureCode: PlanFeatureCode.PUBLIC_PROFILE,
        now,
      }),
    ).toBe(false);
    expect(
      canShowPublicProfile({
        schoolStatus: 'ACTIVE',
        subscription: sub,
        plan: freePlan,
        now,
      }),
    ).toBe(false);
  });

  it('PRESENCE pago não é tratado como FREE', () => {
    const sub = Subscription.rehydrate({
      id: 'sub-p',
      schoolId: 'school-1',
      planId: presencePlan.id,
      status: SubscriptionStatus.ACTIVE,
      startDate: start,
      endDate: null,
      autoRenew: true,
    });
    const dto = toSubscriptionDashboardDto(sub, presencePlan, start);
    expect(dto.isFree).toBe(false);
    expect(dto.planCode).toBe(PlanCode.PRESENCE);
    expect(
      canAccessFeature({
        subscription: sub,
        plan: presencePlan,
        featureCode: PlanFeatureCode.MANAGE_APPLICATIONS,
        now: start,
      }),
    ).toBe(true);
  });

  it('createFreePlan defines 30 days and no autoRenew', () => {
    const sub = Subscription.createFreePlan({
      id: 'sub-new',
      schoolId: 'school-1',
      planId: freePlan.id,
      startDate: start,
    });
    expect(sub.status).toBe(SubscriptionStatus.ACTIVE);
    expect(sub.autoRenew).toBe(false);
    expect(sub.startDate?.toISOString()).toBe(start.toISOString());
    expect(sub.endDate?.toISOString()).toBe(end.toISOString());
    expect(FREE_PLAN_DURATION_DAYS).toBe(30);
  });

  it('syncExpiration marca EXPIRED', () => {
    const sub = freeSub();
    const changed = sub.syncExpiration(new Date('2026-09-10T10:00:00.000Z'));
    expect(changed).toBe(true);
    expect(sub.status).toBe(SubscriptionStatus.EXPIRED);
  });
});
