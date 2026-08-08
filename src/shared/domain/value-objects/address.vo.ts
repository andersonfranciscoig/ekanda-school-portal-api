import { InvariantViolationException } from '../exceptions/domain.exception';

export class Address {
  private constructor(
    private readonly _province: string,
    private readonly _municipality: string,
    private readonly _district: string | null,
    private readonly _neighborhood: string | null,
    private readonly _street: string | null,
  ) {}

  static create(params: {
    province: string;
    municipality: string;
    district?: string | null;
    neighborhood?: string | null;
    street?: string | null;
  }): Address {
    const province = params.province?.trim();
    const municipality = params.municipality?.trim();
    if (!province || !municipality) {
      throw new InvariantViolationException(
        'Address requer province e municipality',
      );
    }
    return new Address(
      province,
      municipality,
      params.district?.trim() || null,
      params.neighborhood?.trim() || null,
      params.street?.trim() || null,
    );
  }

  get province(): string {
    return this._province;
  }

  get municipality(): string {
    return this._municipality;
  }

  get district(): string | null {
    return this._district;
  }

  get neighborhood(): string | null {
    return this._neighborhood;
  }

  get street(): string | null {
    return this._street;
  }
}
