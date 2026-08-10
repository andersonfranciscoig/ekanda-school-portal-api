import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { InvariantViolationException } from '../../../../shared/domain/exceptions/domain.exception';
import { DomainEvent } from '../../../../shared/domain/events/domain-event';

export enum SubscriptionStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  SUSPENDED = 'SUSPENDED',
}

export const FREE_PLAN_DURATION_DAYS = 30;

export class SubscriptionActivatedEvent extends DomainEvent {
  constructor(subscriptionId: string) {
    super(subscriptionId, 'subscription.activated');
  }
}

export class SubscriptionExpiredEvent extends DomainEvent {
  constructor(subscriptionId: string) {
    super(subscriptionId, 'subscription.expired');
  }
}

/**
 * Subscription Aggregate.
 * ACTIVE pago exige pagamento válido; FREE activa-se sem Payment.
 */
export class Subscription extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _schoolId: string,
    private readonly _planId: string,
    private _status: SubscriptionStatus,
    private _startDate: Date | null,
    private _endDate: Date | null,
    private _autoRenew: boolean,
  ) {
    super();
  }

  static rehydrate(params: {
    id: string;
    schoolId: string;
    planId: string;
    status: SubscriptionStatus;
    startDate: Date | null;
    endDate: Date | null;
    autoRenew: boolean;
  }): Subscription {
    return new Subscription(
      params.id,
      params.schoolId,
      params.planId,
      params.status,
      params.startDate,
      params.endDate,
      params.autoRenew,
    );
  }

  /**
   * Cria subscription FREE ACTIVE por `durationDays` (default 30), sem Payment.
   */
  static createFreePlan(params: {
    id: string;
    schoolId: string;
    planId: string;
    startDate: Date;
    durationDays?: number;
  }): Subscription {
    if (!(params.startDate instanceof Date) || Number.isNaN(params.startDate.getTime())) {
      throw new InvariantViolationException('startDate inválida');
    }
    const days = params.durationDays ?? FREE_PLAN_DURATION_DAYS;
    if (!Number.isInteger(days) || days <= 0) {
      throw new InvariantViolationException('durationDays inválido');
    }
    const endDate = new Date(params.startDate.getTime());
    endDate.setUTCDate(endDate.getUTCDate() + days);

    const subscription = new Subscription(
      params.id,
      params.schoolId,
      params.planId,
      SubscriptionStatus.ACTIVE,
      params.startDate,
      endDate,
      false,
    );
    subscription.addDomainEvent(new SubscriptionActivatedEvent(params.id));
    return subscription;
  }

  get id(): string {
    return this._id;
  }

  get schoolId(): string {
    return this._schoolId;
  }

  get planId(): string {
    return this._planId;
  }

  get status(): SubscriptionStatus {
    return this._status;
  }

  get startDate(): Date | null {
    return this._startDate;
  }

  get endDate(): Date | null {
    return this._endDate;
  }

  get autoRenew(): boolean {
    return this._autoRenew;
  }

  activate(params: {
    planIsActive: boolean;
    hasValidPayment: boolean;
    startDate: Date;
    endDate?: Date | null;
  }): void {
    if (!params.planIsActive) {
      throw new InvariantViolationException('Plano deve estar activo');
    }
    if (!params.hasValidPayment) {
      throw new InvariantViolationException('Pagamento válido é obrigatório');
    }
    if (!(params.startDate instanceof Date) || Number.isNaN(params.startDate.getTime())) {
      throw new InvariantViolationException('startDate inválida');
    }
    this._status = SubscriptionStatus.ACTIVE;
    this._startDate = params.startDate;
    if (params.endDate !== undefined) {
      this._endDate = params.endDate;
    }
    this.addDomainEvent(new SubscriptionActivatedEvent(this._id));
  }

  expire(): void {
    if (this._status === SubscriptionStatus.EXPIRED) {
      return;
    }
    this._status = SubscriptionStatus.EXPIRED;
    this.addDomainEvent(new SubscriptionExpiredEvent(this._id));
  }

  /**
   * Válida se ACTIVE e startDate <= now < endDate (quando endDate existe).
   * Expiração por data não depende de cron.
   */
  isValidNow(now = new Date()): boolean {
    if (this._status !== SubscriptionStatus.ACTIVE) return false;
    if (this._startDate && this._startDate > now) return false;
    if (this._endDate && this._endDate <= now) return false;
    return true;
  }

  /**
   * Se ACTIVE mas endDate já passou, marca EXPIRED (lazy sync).
   * @returns true se o estado mudou
   */
  syncExpiration(now = new Date()): boolean {
    if (
      this._status === SubscriptionStatus.ACTIVE &&
      this._endDate != null &&
      this._endDate <= now
    ) {
      this.expire();
      return true;
    }
    return false;
  }
}
