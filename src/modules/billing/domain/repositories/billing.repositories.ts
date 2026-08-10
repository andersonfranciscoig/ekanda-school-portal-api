import { Plan } from '../entities/plan.entity';
import { PlanCode } from '../entities/plan.entity';
import { Subscription } from '../aggregates/subscription.aggregate';
import { Payment } from '../aggregates/payment.aggregate';

export const PLAN_REPOSITORY = Symbol('PLAN_REPOSITORY');
export const SUBSCRIPTION_REPOSITORY = Symbol('SUBSCRIPTION_REPOSITORY');
export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');

export interface PlanRepository {
  findById(id: string): Promise<Plan | null>;
  findByCode(code: PlanCode | string): Promise<Plan | null>;
  listPublicActive(): Promise<Plan[]>;
  save(plan: Plan): Promise<void>;
}

export interface SubscriptionRepository {
  save(subscription: Subscription): Promise<void>;
  findById(id: string): Promise<Subscription | null>;
  findValidActiveBySchoolId(schoolId: string): Promise<Subscription | null>;
  /** Qualquer subscription FREE já concedida (activa ou histórica). */
  findFreeBySchoolId(schoolId: string): Promise<Subscription | null>;
  /** Subscription mais recente da escola (para dashboard). */
  findLatestBySchoolId(schoolId: string): Promise<Subscription | null>;
  countPaymentsBySubscriptionId(subscriptionId: string): Promise<number>;
}

export type SchoolSubscriptionContext = {
  subscription: Subscription;
  plan: Plan;
};

export interface PaymentRepository {
  save(payment: Payment): Promise<void>;
  findById(id: string): Promise<Payment | null>;
  findByExternalTransactionId(externalId: string): Promise<Payment | null>;
}
