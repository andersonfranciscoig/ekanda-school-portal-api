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

export class SubscriptionCancelledEvent extends DomainEvent {
  constructor(subscriptionId: string) {
    super(subscriptionId, 'subscription.cancelled');
  }
}

export class SubscriptionRenewedEvent extends DomainEvent {
  constructor(subscriptionId: string) {
    super(subscriptionId, 'subscription.renewed');
  }
}


export class Subscription extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _schoolId: string,
    private _planId: string,
    private _status: SubscriptionStatus,
    private _startDate: Date | null,
    private _endDate: Date | null,
    private _autoRenew: boolean,
    private _cancelAtPeriodEnd: boolean,
    private _cancelledAt: Date | null,
    private _trialStartedAt: Date | null,
    private _trialEndsAt: Date | null,
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
    cancelAtPeriodEnd?: boolean;
    cancelledAt?: Date | null;
    trialStartedAt?: Date | null;
    trialEndsAt?: Date | null;
  }): Subscription {
    return new Subscription(
      params.id,
      params.schoolId,
      params.planId,
      params.status,
      params.startDate,
      params.endDate,
      params.autoRenew,
      params.cancelAtPeriodEnd ?? false,
      params.cancelledAt ?? null,
      params.trialStartedAt ?? null,
      params.trialEndsAt ?? null,
    );
  }

  static createPending(params: {
    id: string;
    schoolId: string;
    planId: string;
  }): Subscription {
    return new Subscription(
      params.id,
      params.schoolId,
      params.planId,
      SubscriptionStatus.PENDING,
      null,
      null,
      false,
      false,
      null,
      null,
      null,
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
      false,
      null,
      params.startDate,
      endDate,
    );
    subscription.addDomainEvent(new SubscriptionActivatedEvent(params.id));
    return subscription;
  }

  /** Cortesia de admin: ACTIVE sem pagamento, autoRenew=false. */
  static createAdminGrant(params: {
    id: string;
    schoolId: string;
    planId: string;
    startDate: Date;
    endDate: Date;
  }): Subscription {
    if (
      !(params.startDate instanceof Date) ||
      Number.isNaN(params.startDate.getTime())
    ) {
      throw new InvariantViolationException('startDate inválida');
    }
    if (
      !(params.endDate instanceof Date) ||
      Number.isNaN(params.endDate.getTime()) ||
      params.endDate <= params.startDate
    ) {
      throw new InvariantViolationException('endDate deve ser posterior a startDate');
    }
    const subscription = new Subscription(
      params.id,
      params.schoolId,
      params.planId,
      SubscriptionStatus.ACTIVE,
      params.startDate,
      params.endDate,
      false,
      false,
      null,
      null,
      null,
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

  get cancelAtPeriodEnd(): boolean {
    return this._cancelAtPeriodEnd;
  }

  get cancelledAt(): Date | null {
    return this._cancelledAt;
  }

  get trialStartedAt(): Date | null {
    return this._trialStartedAt;
  }

  get trialEndsAt(): Date | null {
    return this._trialEndsAt;
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
    this._cancelAtPeriodEnd = false;
    this._cancelledAt = null;
    this.addDomainEvent(new SubscriptionActivatedEvent(this._id));
  }

  renew(params: {
    hasValidPayment: boolean;
    startDate: Date;
    endDate: Date;
  }): void {
    if (!params.hasValidPayment) {
      throw new InvariantViolationException('Pagamento válido é obrigatório');
    }
    this._status = SubscriptionStatus.ACTIVE;
    this._startDate = params.startDate;
    this._endDate = params.endDate;
    this._cancelAtPeriodEnd = false;
    this._cancelledAt = null;
    this.addDomainEvent(new SubscriptionRenewedEvent(this._id));
  }

  changePlan(planId: string): void {
    if (!planId) {
      throw new InvariantViolationException('planId é obrigatório');
    }
    this._planId = planId;
  }

  scheduleCancelAtPeriodEnd(now = new Date()): void {
    if (this._status !== SubscriptionStatus.ACTIVE) {
      throw new InvariantViolationException(
        'Só é possível cancelar a renovação de uma subscrição ACTIVE',
      );
    }
    this._cancelAtPeriodEnd = true;
    this._autoRenew = false;
    this._cancelledAt = now;
    this.addDomainEvent(new SubscriptionCancelledEvent(this._id));
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
