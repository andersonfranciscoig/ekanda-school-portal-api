import { Payment } from '../../domain/aggregates/payment.aggregate';
import { Subscription } from '../../domain/aggregates/subscription.aggregate';
import { Plan } from '../../domain/entities/plan.entity';
import { InitiateGatewayCheckoutResult } from '../../application/ports/payment-gateway.port';
import { toSubscriptionDashboardDto } from '../../domain/services/subscription-access.service';

export function presentPlan(plan: Plan) {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description,
    price: plan.price.amount,
    currency: plan.price.currency,
    billingPeriod: plan.billingPeriod,
    isActive: plan.isActive,
    isPublic: plan.isPublic,
    features: plan.featureCodes,
  };
}

export function presentSubscription(subscription: Subscription, plan: Plan) {
  return {
    ...toSubscriptionDashboardDto(subscription, plan),
    id: subscription.id,
    schoolId: subscription.schoolId,
    autoRenew: subscription.autoRenew,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    cancelledAt: subscription.cancelledAt?.toISOString() ?? null,
    trialStartedAt: subscription.trialStartedAt?.toISOString() ?? null,
    trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
  };
}

export function presentPayment(payment: Payment) {
  const gateway =
    payment.metadata?.gateway &&
    typeof payment.metadata.gateway === 'object'
      ? (payment.metadata.gateway as Record<string, unknown>)
      : null;

  return {
    id: payment.id,
    schoolId: payment.schoolId,
    subscriptionId: payment.subscriptionId,
    planId: payment.planId,
    amount: payment.amount.amount,
    currency: payment.amount.currency,
    method: payment.method,
    status: payment.status,
    expressPhone: payment.expressPhone,
    externalTransactionId: payment.externalTransactionId,
    externalReference: payment.externalReference,
    paidAt: payment.paidAt?.toISOString() ?? null,
    failureReason: payment.failureReason,
    gateway: gateway
      ? {
          provider: gateway.provider,
          checkoutSessionId: gateway.checkoutSessionId,
          invoiceId: gateway.invoiceId,
          bankReference: gateway.bankReference,
          bankEntity: gateway.bankEntity,
          bankAmount: gateway.bankAmount,
        }
      : null,
  };
}

export function presentCheckout(
  result: InitiateGatewayCheckoutResult,
  paymentStatus: string,
) {
  return {
    provider: result.provider,
    status: paymentStatus,
    checkoutSessionId: result.checkoutSessionId,
    invoiceId: result.invoiceId ?? null,
    expressSent: result.expressSent ?? false,
    bankReference: result.bankReference ?? null,
    bankEntity: result.bankEntity ?? null,
    bankAmount: result.bankAmount ?? null,
  };
}
