import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { InvariantViolationException } from '../../../../shared/domain/exceptions/domain.exception';
import { DomainEvent } from '../../../../shared/domain/events/domain-event';
import { Money } from '../../../../shared/domain/value-objects/money.vo';

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export class PaymentCreatedEvent extends DomainEvent {
  constructor(paymentId: string) {
    super(paymentId, 'payment.created');
  }
}

export class PaymentConfirmedEvent extends DomainEvent {
  constructor(paymentId: string) {
    super(paymentId, 'payment.confirmed');
  }
}

export class PaymentFailedEvent extends DomainEvent {
  constructor(paymentId: string, public readonly reason?: string) {
    super(paymentId, 'payment.failed');
  }
}

/**
 * Payment Aggregate.
 * PAID só via confirmação válida do gateway — nunca pelo frontend.
 */
export class Payment extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _schoolId: string,
    private readonly _subscriptionId: string | null,
    private readonly _planId: string | null,
    private readonly _amount: Money,
    private readonly _method: string,
    private _status: PaymentStatus,
    private _externalTransactionId: string | null,
    private _externalReference: string | null,
    private _expressPhone: string | null,
    private _paidAt: Date | null,
    private _failureReason: string | null,
    private _metadata: Record<string, unknown> | null,
  ) {
    super();
  }

  static create(params: {
    id: string;
    schoolId: string;
    amount: Money;
    method: string;
    subscriptionId?: string | null;
    planId?: string | null;
    expressPhone?: string | null;
    externalReference?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Payment {
    const payment = new Payment(
      params.id,
      params.schoolId,
      params.subscriptionId ?? null,
      params.planId ?? null,
      params.amount,
      params.method,
      PaymentStatus.PENDING,
      null,
      params.externalReference ?? params.id,
      params.expressPhone ?? null,
      null,
      null,
      params.metadata ?? null,
    );
    payment.addDomainEvent(new PaymentCreatedEvent(params.id));
    return payment;
  }

  static rehydrate(params: {
    id: string;
    schoolId: string;
    subscriptionId: string | null;
    planId: string | null;
    amount: Money;
    method: string;
    status: PaymentStatus;
    externalTransactionId: string | null;
    externalReference?: string | null;
    expressPhone?: string | null;
    paidAt: Date | null;
    failureReason: string | null;
    metadata?: Record<string, unknown> | null;
  }): Payment {
    return new Payment(
      params.id,
      params.schoolId,
      params.subscriptionId,
      params.planId,
      params.amount,
      params.method,
      params.status,
      params.externalTransactionId,
      params.externalReference ?? null,
      params.expressPhone ?? null,
      params.paidAt,
      params.failureReason,
      params.metadata ?? null,
    );
  }

  get id(): string {
    return this._id;
  }

  get schoolId(): string {
    return this._schoolId;
  }

  get status(): PaymentStatus {
    return this._status;
  }

  get amount(): Money {
    return this._amount;
  }

  get subscriptionId(): string | null {
    return this._subscriptionId;
  }

  get planId(): string | null {
    return this._planId;
  }

  get method(): string {
    return this._method;
  }

  get externalTransactionId(): string | null {
    return this._externalTransactionId;
  }

  get externalReference(): string | null {
    return this._externalReference;
  }

  get expressPhone(): string | null {
    return this._expressPhone;
  }

  get paidAt(): Date | null {
    return this._paidAt;
  }

  get failureReason(): string | null {
    return this._failureReason;
  }

  get metadata(): Record<string, unknown> | null {
    return this._metadata;
  }

  markProcessing(): void {
    if (this._status === PaymentStatus.PENDING) {
      this._status = PaymentStatus.PROCESSING;
    }
  }

  /**
   * Confirmação só com evidência do gateway (ou simulador Express interno).
   * Idempotente se já PAID com o mesmo externalTransactionId.
   */
  confirmFromGateway(params: {
    externalTransactionId: string;
    paidAt?: Date;
  }): void {
    if (!params.externalTransactionId?.trim()) {
      throw new InvariantViolationException(
        'Confirmação de pagamento requer externalTransactionId do gateway',
      );
    }
    if (this._status === PaymentStatus.PAID) {
      if (this._externalTransactionId === params.externalTransactionId.trim()) {
        return;
      }
      throw new InvariantViolationException(
        'Pagamento já confirmado com outra referência',
      );
    }
    if (
      this._status !== PaymentStatus.PENDING &&
      this._status !== PaymentStatus.PROCESSING
    ) {
      throw new InvariantViolationException(
        `Não é possível confirmar pagamento no estado ${this._status}`,
      );
    }
    this._status = PaymentStatus.PAID;
    this._externalTransactionId = params.externalTransactionId.trim();
    this._paidAt = params.paidAt ?? new Date();
    this.addDomainEvent(new PaymentConfirmedEvent(this._id));
  }

  fail(reason?: string): void {
    this._status = PaymentStatus.FAILED;
    this._failureReason = reason ?? null;
    this.addDomainEvent(new PaymentFailedEvent(this._id, reason));
  }

  cancel(): void {
    if (this._status === PaymentStatus.PAID) {
      throw new InvariantViolationException('Pagamento PAID não pode ser cancelado');
    }
    this._status = PaymentStatus.CANCELLED;
  }

  isPaid(): boolean {
    return this._status === PaymentStatus.PAID;
  }
}
