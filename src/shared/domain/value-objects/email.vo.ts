import { InvariantViolationException } from '../exceptions/domain.exception';

export class Email {
  private constructor(private readonly _value: string) {}

  static create(raw: string): Email {
    const value = raw.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw new InvariantViolationException(`Email inválido: ${raw}`);
    }
    return new Email(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other: Email): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
