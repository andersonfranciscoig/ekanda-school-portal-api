import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { SchoolAccessAuthorizer } from '../../../school/application/services/school-access.authorizer';
import {
  planShortLabel,
  planTagline,
} from '../../domain/services/plan-display.service';
import {
  PAYMENT_REPOSITORY,
  PaymentRepository,
  PLAN_REPOSITORY,
  PlanRepository,
} from '../../domain/repositories/billing.repositories';
import { presentPayment } from '../../infrastructure/http/billing.presenter';

export type ListSchoolPaymentsInput = {
  actorUserId: string;
  schoolId: string;
};

@Injectable()
export class ListSchoolPaymentsUseCase
  implements UseCase<ListSchoolPaymentsInput, unknown>
{
  constructor(
    private readonly access: SchoolAccessAuthorizer,
    @Inject(PAYMENT_REPOSITORY)
    private readonly payments: PaymentRepository,
    @Inject(PLAN_REPOSITORY)
    private readonly plans: PlanRepository,
  ) {}

  async execute(input: ListSchoolPaymentsInput) {
    await this.access.assertCanManageSchool(input.actorUserId, input.schoolId);
    const rows = await this.payments.findManyBySchoolId(input.schoolId);

    const planIds = [
      ...new Set(
        rows.map((row) => row.planId).filter((id): id is string => Boolean(id)),
      ),
    ];
    const planEntries = await Promise.all(
      planIds.map(async (id) => {
        const plan = await this.plans.findById(id);
        return [id, plan] as const;
      }),
    );
    const planMap = new Map(planEntries);

    return {
      items: rows.map((payment) => {
        const plan = payment.planId ? planMap.get(payment.planId) : null;
        return {
          ...presentPayment(payment),
          planCode: plan?.code ?? null,
          planName: plan ? planShortLabel(plan.code) || plan.name : null,
          planTagline: plan ? planTagline(plan.code, plan.name) : null,
        };
      }),
    };
  }
}
