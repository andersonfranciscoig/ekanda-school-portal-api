import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { InvariantViolationException } from '../../../../shared/domain/exceptions/domain.exception';
import { Money } from '../../../../shared/domain/value-objects/money.vo';

export enum PlanCode {
  PRESENCE = 'PRESENCE',
  MANAGEMENT = 'MANAGEMENT',
}

export class Plan extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _code: PlanCode,
    private _name: string,
    private _description: string | null,
    private _price: Money,
    private _billingPeriod: string,
    private _isActive: boolean,
    private _isPublic: boolean,
  ) {
    super();
  }

  static rehydrate(params: {
    id: string;
    code: PlanCode;
    name: string;
    description: string | null;
    price: Money;
    billingPeriod: string;
    isActive: boolean;
    isPublic: boolean;
  }): Plan {
    return new Plan(
      params.id,
      params.code,
      params.name,
      params.description,
      params.price,
      params.billingPeriod,
      params.isActive,
      params.isPublic,
    );
  }

  get id(): string {
    return this._id;
  }

  get code(): PlanCode {
    return this._code;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get price(): Money {
    return this._price;
  }

  activate(): void {
    this._isActive = true;
  }

  deactivate(): void {
    this._isActive = false;
  }

  assertActive(): void {
    if (!this._isActive) {
      throw new InvariantViolationException('Plano inactivo');
    }
  }
}
