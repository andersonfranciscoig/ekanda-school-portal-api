import { InvariantViolationException } from '../exceptions/domain.exception';

export class Phone {
  private constructor(private readonly _value: string) {}

  static create(raw: string): Phone {
    const value = raw.trim();
    if (!/^\+?[0-9]{9,15}$/.test(value)) {
      throw new InvariantViolationException(`Telefone inválido: ${raw}`);
    }
    return new Phone(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other: Phone): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
