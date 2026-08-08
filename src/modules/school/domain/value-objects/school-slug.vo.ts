import { InvariantViolationException } from '../../../../shared/domain/exceptions/domain.exception';

export class SchoolSlug {
  private constructor(private readonly _value: string) {}

  static create(raw: string): SchoolSlug {
    const value = raw.trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
      throw new InvariantViolationException(
        'SchoolSlug deve ser kebab-case minúsculo',
      );
    }
    if (value.length < 2 || value.length > 120) {
      throw new InvariantViolationException('SchoolSlug com tamanho inválido');
    }
    return new SchoolSlug(value);
  }

  static fromName(name: string): SchoolSlug {
    const base = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100);

    const candidate = base.length >= 2 ? base : `escola-${Date.now()}`;
    return SchoolSlug.create(candidate);
  }

  withSuffix(suffix: string | number): SchoolSlug {
    const next = `${this._value}-${suffix}`.slice(0, 120);
    return SchoolSlug.create(next.replace(/-+$/g, ''));
  }

  get value(): string {
    return this._value;
  }

  equals(other: SchoolSlug): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
