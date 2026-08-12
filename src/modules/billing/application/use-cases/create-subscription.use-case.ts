import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  InitiatePaymentCheckoutUseCase,
} from './initiate-payment-checkout.use-case';
import { GatewayPaymentMethod } from '../ports/payment-gateway.port';

export type CreateSubscriptionInput = {
  actorUserId: string;
  schoolId: string;
  planId: string;
  method: GatewayPaymentMethod;
  expressPhone?: string;
};

@Injectable()
export class CreateSubscriptionUseCase
  implements UseCase<CreateSubscriptionInput, unknown>
{
  constructor(
    private readonly checkout: InitiatePaymentCheckoutUseCase,
  ) {}

  execute(input: CreateSubscriptionInput) {
    return this.checkout.execute({
      actorUserId: input.actorUserId,
      schoolId: input.schoolId,
      planId: input.planId,
      method: input.method,
      expressPhone: input.expressPhone,
      action: 'subscribe',
    });
  }
}
