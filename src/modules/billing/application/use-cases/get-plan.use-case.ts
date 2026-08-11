import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { PlanNotFoundException } from '../../domain/exceptions/billing.exceptions';
import {
  PLAN_REPOSITORY,
  PlanRepository,
} from '../../domain/repositories/billing.repositories';
import { presentPlan } from '../../infrastructure/http/billing.presenter';

@Injectable()
export class GetPlanUseCase implements UseCase<{ planId: string }, unknown> {
  constructor(
    @Inject(PLAN_REPOSITORY)
    private readonly plans: PlanRepository,
  ) {}

  async execute(input: { planId: string }) {
    const plan = await this.plans.findById(input.planId);
    if (!plan) throw new PlanNotFoundException();
    return presentPlan(plan);
  }
}
