import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  GatewayWebhookEvent,
  InitiateGatewayCheckoutInput,
  InitiateGatewayCheckoutResult,
  PaymentGateway,
} from '../../application/ports/payment-gateway.port';

type FindoraInvoicePayload = {
  id?: string;
  key_id?: string;
  invoice_id?: string;
};

type FindoraInvoiceResponse = {
  invoice?: FindoraInvoicePayload;
  id?: string;
  invoice_id?: string;
  key_id?: string;
};

type FindoraCheckoutSessionResponse = {
  cstk?: string;
  checkout_session?: { cstk?: string; id?: string };
  checkout_session_token?: string;
  id?: string;
};

type FindoraPaymentIntentResponse = {
  id?: string;
  status?: string;
  next_step?: string;
  bank_reference?: string;
  reference?: string;
  entity?: string;
  bank_entity?: string;
  amount?: number;
};

@Injectable()
export class FindoraPaymentGateway implements PaymentGateway {
  readonly providerName = 'findora';
  private readonly logger = new Logger(FindoraPaymentGateway.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly webhookSecret: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.getOrThrow<string>('FINDORA_BASE_URL');
    this.apiKey = config.getOrThrow<string>('FINDORA_API_KEY');
    this.webhookSecret = config.getOrThrow<string>('FINDORA_WEBHOOK_SECRET');
  }

  async initiateCheckout(
    input: InitiateGatewayCheckoutInput,
  ): Promise<InitiateGatewayCheckoutResult> {
    const currency = this.normalizeCurrency(input.currency);
    const unitPrice = this.toGatewayAmount(input.amount);

    const invoice = await this.request<FindoraInvoiceResponse>('POST', '/invoices', {
      currency,
      metadata: { payment_id: input.paymentId },
      lines: [
        {
          title: input.description,
          unit_price: unitPrice,
          quantity: 1,
        },
      ],
    });

    const invoiceKeyId = this.extractInvoiceKeyId(invoice);
    if (!invoiceKeyId) {
      this.logger.error(
        `Findora invoice response missing key_id: ${JSON.stringify(invoice)}`,
      );
      throw new Error('Findora invoice response missing invoice key_id');
    }

    const session = await this.request<FindoraCheckoutSessionResponse>(
      'POST',
      '/checkout-sessions',
      {
        invoice_key_id: invoiceKeyId,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: { payment_id: input.paymentId },
      },
    );

    const checkoutSessionId = this.extractCheckoutSessionId(session);
    if (!checkoutSessionId) {
      throw new Error('Findora checkout session response missing session id');
    }

    let intent: FindoraPaymentIntentResponse | undefined;
    if (input.method === 'MULTICAIXA_EXPRESS') {
      if (!input.expressPhone) {
        throw new Error('expressPhone is required for Multicaixa Express');
      }
      intent = await this.request<FindoraPaymentIntentResponse>(
        'POST',
        '/payment-intents/multicaixa-express',
        {
          cstk: checkoutSessionId,
          phone: Number(input.expressPhone),
        },
      );
    } else {
      intent = await this.request<FindoraPaymentIntentResponse>(
        'POST',
        '/payment-intents/bank-reference',
        { cstk: checkoutSessionId },
      );
    }

    return {
      provider: this.providerName,
      checkoutSessionId,
      invoiceId: invoiceKeyId,
      paymentIntentId: intent?.id ?? intent?.next_step,
      bankReference: intent?.bank_reference ?? intent?.reference,
      bankEntity: intent?.entity ?? intent?.bank_entity,
      bankAmount: intent?.amount ?? input.amount,
      expressSent: input.method === 'MULTICAIXA_EXPRESS',
    };
  }

  private extractInvoiceKeyId(response: FindoraInvoiceResponse): string | null {
    const nested = response.invoice;
    return (
      this.asString(nested?.key_id) ??
      this.asString(nested?.invoice_id) ??
      this.asString(nested?.id) ??
      this.asString(response.key_id) ??
      this.asString(response.invoice_id) ??
      this.asString(response.id)
    );
  }

  private extractCheckoutSessionId(
    response: FindoraCheckoutSessionResponse,
  ): string | null {
    return (
      this.asString(response.cstk) ??
      this.asString(response.checkout_session?.cstk) ??
      this.asString(response.checkout_session_token) ??
      this.asString(response.checkout_session?.id) ??
      this.asString(response.id)
    );
  }

  verifyWebhookSignature(
    rawBody: string,
    signature: string | undefined,
  ): boolean {
    if (!signature?.trim()) return false;
    const computed = createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');
    const received = signature.trim();
    if (computed.length !== received.length) return false;
    return timingSafeEqual(Buffer.from(computed), Buffer.from(received));
  }

  parseWebhookEvent(rawBody: string): GatewayWebhookEvent {
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const data =
      payload.data && typeof payload.data === 'object'
        ? (payload.data as Record<string, unknown>)
        : payload;

    const metadata =
      data.metadata && typeof data.metadata === 'object'
        ? (data.metadata as Record<string, unknown>)
        : payload.metadata && typeof payload.metadata === 'object'
          ? (payload.metadata as Record<string, unknown>)
          : {};

    const paymentId =
      this.asString(metadata.payment_id) ??
      this.asString(data.payment_id) ??
      this.asString(payload.payment_id);

    const checkoutSessionId =
      this.asString(data.cstk) ??
      this.asString(data.checkout_session_id) ??
      this.asString(data.checkout_session_token) ??
      this.asString(payload.cstk);

    const invoiceId =
      this.asString(data.invoice_id) ?? this.asString(payload.invoice_id);

    const eventType =
      this.asString(payload.event) ??
      this.asString(payload.event_type) ??
      this.asString(payload.type) ??
      'payment.updated';

    const rawStatus =
      this.asString(data.status) ??
      this.asString(payload.status) ??
      eventType;

    const eventId =
      this.asString(payload.id) ??
      this.asString(payload.event_id) ??
      `${eventType}:${checkoutSessionId ?? paymentId ?? Date.now()}`;

    const externalTransactionId =
      this.asString(data.id) ??
      this.asString(data.payment_intent_id) ??
      this.asString(payload.id) ??
      eventId;

    return {
      eventId,
      eventType,
      paymentId: paymentId ?? undefined,
      checkoutSessionId: checkoutSessionId ?? undefined,
      invoiceId: invoiceId ?? undefined,
      externalTransactionId,
      status: this.mapStatus(rawStatus),
      rawPayload: payload,
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const url = `${this.baseUrl.replace(/\/$/, '')}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let parsed: unknown = {};
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: text };
      }
    }

    if (!response.ok) {
      this.logger.error(
        `Findora ${method} ${path} failed (${response.status}): ${text}`,
      );
      throw new Error(
        `Findora request failed (${response.status}): ${text.slice(0, 300)}`,
      );
    }

    return parsed as T;
  }

  private normalizeCurrency(currency: string): string {
    const normalized = currency.trim().toUpperCase();
    if (normalized === 'KZ' || normalized === 'Kz') return 'AOA';
    return normalized;
  }

  /** Findora exige unit_price > 0. */
  private toGatewayAmount(amount: number): number {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Payment amount must be greater than zero for Findora');
    }
    return amount;
  }

  private mapStatus(raw: string): GatewayWebhookEvent['status'] {
    const value = raw.toUpperCase();
    if (
      value.includes('PAID') ||
      value.includes('SUCCESS') ||
      value.includes('COMPLETED')
    ) {
      return 'PAID';
    }
    if (value.includes('CANCEL')) return 'CANCELLED';
    if (value.includes('FAIL') || value.includes('EXPIRE')) return 'FAILED';
    return 'FAILED';
  }

  private asString(value: unknown): string | null {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    return null;
  }
}
