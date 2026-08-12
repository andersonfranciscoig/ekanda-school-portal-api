export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export type GatewayPaymentMethod = 'MULTICAIXA_EXPRESS' | 'BANK_REFERENCE';

export type InitiateGatewayCheckoutInput = {
  paymentId: string;
  amount: number;
  currency: string;
  description: string;
  method: GatewayPaymentMethod;
  expressPhone?: string;
  successUrl: string;
  cancelUrl: string;
};

export type InitiateGatewayCheckoutResult = {
  provider: string;
  checkoutSessionId: string;
  invoiceId?: string;
  paymentIntentId?: string;
  bankReference?: string;
  bankEntity?: string;
  bankAmount?: number;
  expressSent?: boolean;
};

export type GatewayWebhookEvent = {
  eventId: string;
  eventType: string;
  paymentId?: string;
  checkoutSessionId?: string;
  invoiceId?: string;
  externalTransactionId: string;
  status: 'PAID' | 'FAILED' | 'CANCELLED';
  rawPayload: unknown;
};

export interface PaymentGateway {
  readonly providerName: string;
  initiateCheckout(
    input: InitiateGatewayCheckoutInput,
  ): Promise<InitiateGatewayCheckoutResult>;
  verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean;
  parseWebhookEvent(rawBody: string): GatewayWebhookEvent;
}
