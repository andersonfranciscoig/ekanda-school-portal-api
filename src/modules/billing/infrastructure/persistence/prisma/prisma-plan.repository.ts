import { Injectable } from '@nestjs/common';
import {
  PlanCode as PrismaPlanCode,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { Money } from '../../../../../shared/domain/value-objects/money.vo';
import { Plan, PlanCode } from '../../../domain/entities/plan.entity';
import { PlanRepository } from '../../../domain/repositories/billing.repositories';

@Injectable()
export class PrismaPlanRepository implements PlanRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Plan | null> {
    const record = await this.prisma.plan.findUnique({
      where: { id },
      include: { features: { select: { code: true } } },
    });
    return record ? this.toDomain(record) : null;
  }

  async findByCode(code: PlanCode | string): Promise<Plan | null> {
    const record = await this.prisma.plan.findUnique({
      where: { code: code as PrismaPlanCode },
      include: { features: { select: { code: true } } },
    });
    return record ? this.toDomain(record) : null;
  }

  async listPublicActive(): Promise<Plan[]> {
    const records = await this.prisma.plan.findMany({
      where: { isActive: true, isPublic: true },
      include: { features: { select: { code: true } } },
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async save(plan: Plan): Promise<void> {
    await this.prisma.plan.update({
      where: { id: plan.id },
      data: {
        isActive: plan.isActive,
        isPublic: plan.isPublic,
        name: plan.name,
        description: plan.description,
        price: plan.price.amount,
        currency: plan.price.currency,
        billingPeriod: plan.billingPeriod as never,
      },
    });
  }

  private toDomain(
    record: {
      id: string;
      code: PrismaPlanCode;
      name: string;
      description: string | null;
      price: Prisma.Decimal;
      currency: string;
      billingPeriod: string;
      isActive: boolean;
      isPublic: boolean;
      features?: Array<{ code: string }>;
    },
  ): Plan {
    return Plan.rehydrate({
      id: record.id,
      code: record.code as PlanCode,
      name: record.name,
      description: record.description,
      price: Money.create(Number(record.price), record.currency),
      billingPeriod: record.billingPeriod,
      isActive: record.isActive,
      isPublic: record.isPublic,
      featureCodes: record.features?.map((f) => f.code) ?? [],
    });
  }
}
