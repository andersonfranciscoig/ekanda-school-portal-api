import { Address } from '../../../../shared/domain/value-objects/address.vo';
import { Coordinates } from '../../../../shared/domain/value-objects/coordinates.vo';

export class SchoolLocation {
  private constructor(
    private readonly _id: string,
    private readonly _address: Address,
    private readonly _coordinates: Coordinates | null,
  ) {}

  static create(params: {
    id: string;
    address: Address;
    coordinates?: Coordinates | null;
  }): SchoolLocation {
    return new SchoolLocation(
      params.id,
      params.address,
      params.coordinates ?? null,
    );
  }

  get id(): string {
    return this._id;
  }

  get address(): Address {
    return this._address;
  }

  get coordinates(): Coordinates | null {
    return this._coordinates;
  }
}
