import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  InitiatePaymentCheckoutUseCase,
} from './initiate-payment-checkout.use-case';
import { GatewayPaymentMethod } from '../ports/payment-gateway.port';

export type StartPaymentInput = {
  actorUserId: string;
  schoolId: string;
  planId: string;
  subscriptionId?: string;
  method: GatewayPaymentMethod;
  expressPhone?: string;
};

@Injectable()
export class StartPaymentUseCase implements UseCase<StartPaymentInput, unknown> {
  constructor(
    private readonly checkout: InitiatePaymentCheckoutUseCase,
  ) {}

  execute(input: StartPaymentInput) {
    return this.checkout.execute({
      actorUserId: input.actorUserId,
      schoolId: input.schoolId,
      planId: input.planId,
      subscriptionId: input.subscriptionId,
      method: input.method,
      expressPhone: input.expressPhone,
      action: 'subscribe',
    });
  }
}
