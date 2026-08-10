import { Injectable } from '@nestjs/common';
import {
  PlanCode as PrismaPlanCode,
  SubscriptionStatus as PrismaSubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../../../../shared/infrastructure/persistence/prisma/prisma.service';
import {
  Subscription,
  SubscriptionStatus,
} from '../../../domain/aggregates/subscription.aggregate';
import { SubscriptionRepository } from '../../../domain/repositories/billing.repositories';

@Injectable()
export class PrismaSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(subscription: Subscription): Promise<void> {
    await this.prisma.subscription.upsert({
      where: { id: subscription.id },
      create: {
        id: subscription.id,
        schoolId: subscription.schoolId,
        planId: subscription.planId,
        status: subscription.status as PrismaSubscriptionStatus,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        autoRenew: subscription.autoRenew,
      },
      update: {
        status: subscription.status as PrismaSubscriptionStatus,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        autoRenew: subscription.autoRenew,
        planId: subscription.planId,
      },
    });
  }

  async findById(id: string): Promise<Subscription | null> {
    const record = await this.prisma.subscription.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findValidActiveBySchoolId(
    schoolId: string,
  ): Promise<Subscription | null> {
    const now = new Date();
    const record = await this.prisma.subscription.findFirst({
      where: {
        schoolId,
        status: PrismaSubscriptionStatus.ACTIVE,
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: now } }] },
          { OR: [{ endDate: null }, { endDate: { gt: now } }] },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    return record ? this.toDomain(record) : null;
  }

  async findFreeBySchoolId(schoolId: string): Promise<Subscription | null> {
    const record = await this.prisma.subscription.findFirst({
      where: {
        schoolId,
        plan: { code: PrismaPlanCode.FREE },
      },
      orderBy: { createdAt: 'asc' },
    });
    return record ? this.toDomain(record) : null;
  }

  async findLatestBySchoolId(schoolId: string): Promise<Subscription | null> {
    const record = await this.prisma.subscription.findFirst({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
    });
    return record ? this.toDomain(record) : null;
  }

  async countPaymentsBySubscriptionId(
    subscriptionId: string,
  ): Promise<number> {
    return this.prisma.payment.count({ where: { subscriptionId } });
  }

  private toDomain(record: {
    id: string;
    schoolId: string;
    planId: string;
    status: PrismaSubscriptionStatus;
    startDate: Date | null;
    endDate: Date | null;
    autoRenew: boolean;
  }): Subscription {
    return Subscription.rehydrate({
      id: record.id,
      schoolId: record.schoolId,
      planId: record.planId,
      status: record.status as SubscriptionStatus,
      startDate: record.startDate,
      endDate: record.endDate,
      autoRenew: record.autoRenew,
    });
  }
}
