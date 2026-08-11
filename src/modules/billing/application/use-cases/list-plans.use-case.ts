import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  PLAN_REPOSITORY,
  PlanRepository,
} from '../../domain/repositories/billing.repositories';
import { presentPlan } from '../../infrastructure/http/billing.presenter';

@Injectable()
export class ListPlansUseCase implements UseCase<void, unknown> {
  constructor(
    @Inject(PLAN_REPOSITORY)
    private readonly plans: PlanRepository,
  ) {}

  async execute() {
    const plans = await this.plans.listPublicActive();
    return plans.map(presentPlan);
  }
}
