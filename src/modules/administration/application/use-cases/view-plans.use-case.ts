import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/domain.exception';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { presentAdminPlan } from '../services/admin.presenter';

const planInclude = { features: { select: { code: true } } } as const;

@Injectable()
export class ViewPlansUseCase implements UseCase<void, unknown> {
  constructor(private readonly prisma: PrismaService) {}

  async execute() {
    const plans = await this.prisma.plan.findMany({
      include: planInclude,
      orderBy: { code: 'asc' },
    });
    return plans.map(presentAdminPlan);
  }

  async getById(planId: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      include: planInclude,
    });
    if (!plan) throw new EntityNotFoundException('Plan not found');
    return presentAdminPlan(plan);
  }
}
