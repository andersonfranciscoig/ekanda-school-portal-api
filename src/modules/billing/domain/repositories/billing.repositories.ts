import { Plan } from '../entities/plan.entity';
import { Subscription } from '../aggregates/subscription.aggregate';
import { Payment } from '../aggregates/payment.aggregate';

export const PLAN_REPOSITORY = Symbol('PLAN_REPOSITORY');
export const SUBSCRIPTION_REPOSITORY = Symbol('SUBSCRIPTION_REPOSITORY');
export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');

export interface PlanRepository {
  findById(id: string): Promise<Plan | null>;
  findByCode(code: string): Promise<Plan | null>;
  listPublicActive(): Promise<Plan[]>;
  save(plan: Plan): Promise<void>;
}

export interface SubscriptionRepository {
  save(subscription: Subscription): Promise<void>;
  findById(id: string): Promise<Subscription | null>;
  findValidActiveBySchoolId(schoolId: string): Promise<Subscription | null>;
}

export interface PaymentRepository {
  save(payment: Payment): Promise<void>;
  findById(id: string): Promise<Payment | null>;
  findByExternalTransactionId(externalId: string): Promise<Payment | null>;
}
