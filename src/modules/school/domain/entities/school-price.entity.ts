import { Money } from '../../../../shared/domain/value-objects/money.vo';

export class SchoolPrice {
  private constructor(
    private readonly _id: string,
    private _name: string,
    private _amount: Money,
    private _billingPeriod: string,
    private _schoolClassId: string | null,
    private _isActive: boolean,
  ) {}

  static create(params: {
    id: string;
    name: string;
    amount: Money;
    billingPeriod: string;
    schoolClassId?: string | null;
    isActive?: boolean;
  }): SchoolPrice {
    return new SchoolPrice(
      params.id,
      params.name.trim(),
      params.amount,
      params.billingPeriod,
      params.schoolClassId ?? null,
      params.isActive ?? true,
    );
  }

  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get amount(): Money {
    return this._amount;
  }

  get isActive(): boolean {
    return this._isActive;
  }
}
