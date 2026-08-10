import {
  Subscription,
  SubscriptionStatus,
} from '../aggregates/subscription.aggregate';
import { Plan, PlanCode } from '../entities/plan.entity';

export type SubscriptionValidityView = {
  status: SubscriptionStatus;
  isExpired: boolean;
  isValid: boolean;
  daysRemaining: number;
};


export function evaluateSubscriptionValidity(
  subscription: Subscription,
  now = new Date(),
): SubscriptionValidityView {
  const expiredByDate =
    subscription.endDate != null && subscription.endDate <= now;
  const isExpired =
    subscription.status === SubscriptionStatus.EXPIRED ||
    (subscription.status === SubscriptionStatus.ACTIVE && expiredByDate);

  const isValid = subscription.isValidNow(now);

  let daysRemaining = 0;
  if (
    !isExpired &&
    subscription.endDate != null &&
    subscription.startDate != null
  ) {
    const ms = subscription.endDate.getTime() - now.getTime();
    daysRemaining = Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }

  return {
    status: isExpired ? SubscriptionStatus.EXPIRED : subscription.status,
    isExpired,
    isValid,
    daysRemaining,
  };
}

export type SubscriptionDashboardDto = {
  planId: string;
  planCode: PlanCode | string;
  planName: string;
  status: SubscriptionStatus;
  startDate: string | null;
  endDate: string | null;
  daysRemaining: number;
  isFree: boolean;
  isExpired: boolean;
};

export function toSubscriptionDashboardDto(
  subscription: Subscription,
  plan: Plan,
  now = new Date(),
): SubscriptionDashboardDto {
  const validity = evaluateSubscriptionValidity(subscription, now);
  return {
    planId: plan.id,
    planCode: plan.code,
    planName: plan.name,
    status: validity.status,
    startDate: subscription.startDate?.toISOString() ?? null,
    endDate: subscription.endDate?.toISOString() ?? null,
    daysRemaining: validity.daysRemaining,
    isFree: plan.isFree(),
    isExpired: validity.isExpired,
  };
}

/**
 * Perfil público visível: School ACTIVE + subscription válida no tempo
 * + feature PUBLIC_PROFILE no plano.
 */
export function canShowPublicProfile(params: {
  schoolStatus: string;
  subscription: Subscription | null;
  plan: Plan | null;
  now?: Date;
}): boolean {
  if (params.schoolStatus !== 'ACTIVE') return false;
  if (!params.subscription || !params.plan) return false;
  if (!params.subscription.isValidNow(params.now)) return false;
  return params.plan.hasFeature('PUBLIC_PROFILE');
}

export function canAccessFeature(params: {
  subscription: Subscription | null;
  plan: Plan | null;
  featureCode: string;
  now?: Date;
}): boolean {
  if (!params.subscription || !params.plan) return false;
  if (!params.subscription.isValidNow(params.now)) return false;
  return params.plan.hasFeature(params.featureCode);
}
