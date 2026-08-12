import { Injectable } from '@nestjs/common';
import {
  GatewayWebhookEvent,
  InitiateGatewayCheckoutInput,
  InitiateGatewayCheckoutResult,
  PaymentGateway,
} from '../../application/ports/payment-gateway.port';

/**
 * Dev/staging gateway — auto-confirms on initiate (legacy behaviour).
 * Swap PAYMENT_GATEWAY=findora in production.
 */
@Injectable()
export class SimulatedPaymentGateway implements PaymentGateway {
  readonly providerName = 'simulated';

  async initiateCheckout(
    input: InitiateGatewayCheckoutInput,
  ): Promise<InitiateGatewayCheckoutResult> {
    const checkoutSessionId = `sim_${input.paymentId}`;
    return {
      provider: this.providerName,
      checkoutSessionId,
      invoiceId: `INV-SIM-${input.paymentId.slice(0, 8)}`,
      paymentIntentId: `PI-SIM-${input.paymentId.slice(0, 8)}`,
      expressSent: input.method === 'MULTICAIXA_EXPRESS',
      bankReference:
        input.method === 'BANK_REFERENCE'
          ? `${Math.floor(100000000 + Math.random() * 900000000)}`
          : undefined,
      bankEntity: input.method === 'BANK_REFERENCE' ? '99999' : undefined,
      bankAmount: input.method === 'BANK_REFERENCE' ? input.amount : undefined,
    };
  }

  verifyWebhookSignature(_rawBody: string, _signature: string | undefined): boolean {
    return true;
  }

  parseWebhookEvent(rawBody: string): GatewayWebhookEvent {
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const paymentId = String(payload.paymentId ?? '');
    return {
      eventId: String(payload.eventId ?? `sim:${paymentId}`),
      eventType: String(payload.eventType ?? 'payment.paid'),
      paymentId: paymentId || undefined,
      externalTransactionId: String(
        payload.externalTransactionId ?? `SIM-${paymentId}`,
      ),
      status: 'PAID',
      rawPayload: payload,
    };
  }
}
