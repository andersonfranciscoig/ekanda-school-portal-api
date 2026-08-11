import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { SchoolAccessAuthorizer } from '../../../school/application/services/school-access.authorizer';
import {
  PAYMENT_REPOSITORY,
  PaymentRepository,
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
  ) {}

  async execute(input: ListSchoolPaymentsInput) {
    await this.access.assertCanManageSchool(input.actorUserId, input.schoolId);
    const rows = await this.payments.findManyBySchoolId(input.schoolId);
    return { items: rows.map(presentPayment) };
  }
}
