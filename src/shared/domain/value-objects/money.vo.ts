import { InvariantViolationException } from '../exceptions/domain.exception';

export class Money {
  private constructor(
    private readonly _amount: number,
    private readonly _currency: string,
  ) {}

  static create(amount: number, currency = 'Kz'): Money {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new InvariantViolationException('invalid monetary amount');
    }
    const normalizedCurrency = currency.trim();
    if (!normalizedCurrency) {
      throw new InvariantViolationException('currency is required');
    }
    return new Money(amount, normalizedCurrency);
  }

  get amount(): number {
    return this._amount;
  }

  get currency(): string {
    return this._currency;
  }

  equals(other: Money): boolean {
    return this._amount === other._amount && this._currency === other._currency;
  }
}
