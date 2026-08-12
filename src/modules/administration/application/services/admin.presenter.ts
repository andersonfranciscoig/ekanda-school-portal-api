import { PaymentStatus, Prisma } from '@prisma/client';
import { fullName, shortCode } from '../../../../shared/application/pagination';
import { planShortLabel, planTagline } from '../../../billing/domain/services/plan-display.service';

export type AdminUserListItem = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string | null;
  roles: string[];
  isActive: boolean;
  createdAt: string;
};

export type AdminUserDetail = AdminUserListItem & {
  memberships: Array<{
    schoolId: string;
    schoolName: string;
    role: string;
  }>;
};

type UserRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: Date;
  platformRoles: Array<{ role: string }>;
};

export function presentAdminUser(user: UserRow): AdminUserListItem {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    name: fullName(user.firstName, user.lastName),
    email: user.email,
    phone: user.phone,
    roles: user.platformRoles.map((role) => role.role),
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}

export function presentAdminUserDetail(
  user: UserRow & {
    memberships: Array<{
      role: string;
      school: { id: string; name: string };
    }>;
  },
): AdminUserDetail {
  return {
    ...presentAdminUser(user),
    memberships: user.memberships.map((membership) => ({
      schoolId: membership.school.id,
      schoolName: membership.school.name,
      role: membership.role,
    })),
  };
}

export function presentAdminPlan(plan: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: Prisma.Decimal | number;
  currency: string;
  billingPeriod: string;
  isActive: boolean;
  isPublic: boolean;
  features: Array<{ code: string }>;
}) {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description,
    price: Number(plan.price),
    currency: plan.currency,
    billingPeriod: plan.billingPeriod,
    isActive: plan.isActive,
    isPublic: plan.isPublic,
    features: plan.features.map((feature) => feature.code),
  };
}

export function paymentCode(
  externalReference: string | null | undefined,
  id: string,
): string {
  return externalReference?.trim() || shortCode('EKD-PAY-', id, 4);
}

export function daysRemaining(endDate: Date | null, now = new Date()): number {
  if (!endDate) return 0;
  const ms = endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export function subscriptionIsExpired(
  status: string,
  endDate: Date | null,
  now = new Date(),
): boolean {
  return (
    status === 'EXPIRED' ||
    (status === 'ACTIVE' && endDate != null && endDate <= now)
  );
}

type PaymentListRow = Prisma.PaymentGetPayload<{
  include: {
    school: { select: { id: true; name: true; slug: true } };
    plan: { select: { id: true; code: true; name: true } };
  };
}>;

export function presentAdminPayment(row: PaymentListRow) {
  return {
    id: row.id,
    code: paymentCode(row.externalReference, row.id),
    status: row.status as PaymentStatus,
    amount: Number(row.amount),
    currency: row.currency,
    method: row.method,
    expressPhone: row.expressPhone,
    externalReference: row.externalReference,
    externalTransactionId: row.externalTransactionId,
    paidAt: row.paidAt?.toISOString() ?? null,
    failureReason: row.failureReason,
    createdAt: row.createdAt.toISOString(),
    school: row.school,
    plan: row.plan
      ? { id: row.plan.id, code: row.plan.code, name: row.plan.name }
      : null,
    subscriptionId: row.subscriptionId,
  };
}

export function presentAdminPaymentDetail(
  row: PaymentListRow & {
    events: Array<{
      id: string;
      eventType: string;
      createdAt: Date;
      payload: Prisma.JsonValue;
    }>;
  },
) {
  return {
    ...presentAdminPayment(row),
    timeline: row.events.map((event) => ({
      id: event.id,
      title: event.eventType,
      at: event.createdAt.toISOString(),
      description:
        event.payload &&
        typeof event.payload === 'object' &&
        !Array.isArray(event.payload) &&
        'description' in event.payload &&
        typeof event.payload.description === 'string'
          ? event.payload.description
          : null,
    })),
  };
}

type SubscriptionListRow = Prisma.SubscriptionGetPayload<{
  include: {
    school: { select: { id: true; name: true; slug: true } };
    plan: {
      select: {
        id: true;
        code: true;
        name: true;
        price: true;
        currency: true;
      };
    };
  };
}>;

export function presentAdminSubscription(
  row: SubscriptionListRow,
  now = new Date(),
) {
  const expired = subscriptionIsExpired(row.status, row.endDate, now);
  return {
    id: row.id,
    status: expired && row.status === 'ACTIVE' ? 'EXPIRED' : row.status,
    startDate: row.startDate?.toISOString() ?? null,
    endDate: row.endDate?.toISOString() ?? null,
    daysRemaining: expired ? 0 : daysRemaining(row.endDate, now),
    isExpired: expired,
    autoRenew: row.autoRenew,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    school: row.school,
    plan: {
      id: row.plan.id,
      code: row.plan.code,
      name: planShortLabel(row.plan.code) || row.plan.name,
      tagline: planTagline(row.plan.code, row.plan.name),
      price: Number(row.plan.price),
      currency: row.plan.currency,
    },
  };
}
