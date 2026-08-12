import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { PaymentNotFoundException } from '../../domain/exceptions/billing.exceptions';
import {
  PAYMENT_REPOSITORY,
  PaymentRepository,
} from '../../domain/repositories/billing.repositories';
import {
  PAYMENT_GATEWAY,
  PaymentGateway,
} from '../ports/payment-gateway.port';
import { ProcessPaymentUseCase } from './process-payment.use-case';

export type ProcessFindoraWebhookInput = {
  rawBody: string;
  signature?: string;
};

@Injectable()
export class ProcessFindoraWebhookUseCase
  implements UseCase<ProcessFindoraWebhookInput, unknown>
{
  constructor(
    @Inject(PAYMENT_GATEWAY)
    private readonly gateway: PaymentGateway,
    @Inject(PAYMENT_REPOSITORY)
    private readonly payments: PaymentRepository,
    private readonly processPayment: ProcessPaymentUseCase,
  ) {}

  async execute(input: ProcessFindoraWebhookInput) {
    if (!this.gateway.verifyWebhookSignature(input.rawBody, input.signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const event = this.gateway.parseWebhookEvent(input.rawBody);
    const payment = await this.resolvePayment(event);

    if (!payment) {
      throw new PaymentNotFoundException();
    }

    return this.processPayment.execute({
      eventId: event.eventId,
      eventType: event.eventType,
      paymentId: payment.id,
      externalTransactionId: event.externalTransactionId,
      status: event.status,
    });
  }

  private async resolvePayment(event: {
    paymentId?: string;
    checkoutSessionId?: string;
    invoiceId?: string;
    externalTransactionId: string;
  }) {
    if (event.paymentId) {
      const byId = await this.payments.findById(event.paymentId);
      if (byId) return byId;
    }

    if (event.checkoutSessionId) {
      const bySession = await this.payments.findByGatewayCheckoutSessionId(
        event.checkoutSessionId,
      );
      if (bySession) return bySession;
    }

    if (event.invoiceId) {
      const byInvoice = await this.payments.findByGatewayInvoiceId(
        event.invoiceId,
      );
      if (byInvoice) return byInvoice;
    }

    return this.payments.findByExternalTransactionId(
      event.externalTransactionId,
    );
  }
}
