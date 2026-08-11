import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { SchoolAccessAuthorizer } from '../../../school/application/services/school-access.authorizer';
import { PaymentNotFoundException } from '../../domain/exceptions/billing.exceptions';
import {
  PAYMENT_REPOSITORY,
  PaymentRepository,
} from '../../domain/repositories/billing.repositories';
import { presentPayment } from '../../infrastructure/http/billing.presenter';

export type GetPaymentInput = {
  actorUserId: string;
  paymentId: string;
};

@Injectable()
export class GetPaymentUseCase implements UseCase<GetPaymentInput, unknown> {
  constructor(
    private readonly access: SchoolAccessAuthorizer,
    @Inject(PAYMENT_REPOSITORY)
    private readonly payments: PaymentRepository,
  ) {}

  async execute(input: GetPaymentInput) {
    const payment = await this.payments.findById(input.paymentId);
    if (!payment) throw new PaymentNotFoundException();
    await this.access.assertCanManageSchool(input.actorUserId, payment.schoolId);
    return presentPayment(payment);
  }
}
