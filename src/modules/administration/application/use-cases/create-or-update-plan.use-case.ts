import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/domain.exception';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { presentAdminPlan } from '../services/admin.presenter';

export type UpdatePlanInput = {
  planId: string;
  name?: string;
  description?: string | null;
  price?: number;
  isActive?: boolean;
  isPublic?: boolean;
  features?: string[];
};

@Injectable()
export class CreateOrUpdatePlanUseCase
  implements UseCase<UpdatePlanInput, unknown>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: UpdatePlanInput) {
    const existing = await this.prisma.plan.findUnique({
      where: { id: input.planId },
      include: { features: true },
    });
    if (!existing) throw new EntityNotFoundException('Plan not found');

    const nextFeatures = input.features
      ?.map((code) => code.trim())
      .filter(Boolean);

    await this.prisma.$transaction(async (tx) => {
      await tx.plan.update({
        where: { id: input.planId },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined
            ? { description: input.description?.trim() || null }
            : {}),
          ...(input.price !== undefined ? { price: input.price } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
        },
      });

      if (!nextFeatures) return;

      const current = existing.features.map((feature) => feature.code);

      await tx.planFeature.deleteMany({
        where: {
          planId: input.planId,
          code: { notIn: nextFeatures },
        },
      });

      for (const code of nextFeatures) {
        if (current.includes(code)) continue;
        await tx.planFeature.create({
          data: {
            id: crypto.randomUUID(),
            planId: input.planId,
            code,
            name: code,
          },
        });
      }
    });

    const plan = await this.prisma.plan.findUniqueOrThrow({
      where: { id: input.planId },
      include: { features: { select: { code: true } } },
    });
    return presentAdminPlan(plan);
  }
}
