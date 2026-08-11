import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ConfirmPaymentUseCase } from './confirm-payment.use-case';
import { FailPaymentUseCase } from './fail-payment.use-case';

export type ProcessPaymentWebhookInput = {
  eventId: string;
  eventType: string;
  paymentId: string;
  externalTransactionId?: string;
  status?: string;
  actorUserId?: string | null;
};

@Injectable()
export class ProcessPaymentUseCase
  implements UseCase<ProcessPaymentWebhookInput, unknown>
{
  constructor(
    private readonly confirmPayment: ConfirmPaymentUseCase,
    private readonly failPayment: FailPaymentUseCase,
  ) {}

  async execute(input: ProcessPaymentWebhookInput) {
    const status = (input.status ?? input.eventType).toUpperCase();
    if (status.includes('FAIL') || status.includes('CANCEL')) {
      return this.failPayment.execute({
        paymentId: input.paymentId,
        reason: input.eventType,
        actorUserId: input.actorUserId,
      });
    }

    return this.confirmPayment.execute({
      paymentId: input.paymentId,
      externalTransactionId: input.externalTransactionId ?? input.eventId,
      actorUserId: input.actorUserId,
    });
  }
}
