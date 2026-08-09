import { Address } from '../../../../shared/domain/value-objects/address.vo';
import { Coordinates } from '../../../../shared/domain/value-objects/coordinates.vo';
import { InvalidSchoolLocationException } from '../exceptions/school.exceptions';

export type SchoolLocationSnapshot = {
  id: string;
  schoolId: string;
  province: string;
  municipality: string;
  neighborhood: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
};

export class SchoolLocation {
  private constructor(
    private readonly _id: string,
    private readonly _schoolId: string,
    private _address: Address,
    private _coordinates: Coordinates | null,
  ) {}

  static create(params: {
    id: string;
    schoolId: string;
    province: string;
    municipality: string;
    neighborhood?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  }): SchoolLocation {
    const schoolId = params.schoolId?.trim();
    if (!schoolId) {
      throw new InvalidSchoolLocationException('schoolId is required');
    }

    const address = Address.create({
      province: params.province,
      municipality: params.municipality,
      neighborhood: params.neighborhood,
      street: params.address,
      district: null,
    });

    const coordinates = SchoolLocation.resolveCoordinates(
      params.latitude,
      params.longitude,
    );

    return new SchoolLocation(params.id, schoolId, address, coordinates);
  }

  static rehydrate(params: {
    id: string;
    schoolId: string;
    address: Address;
    coordinates?: Coordinates | null;
  }): SchoolLocation {
    return new SchoolLocation(
      params.id,
      params.schoolId,
      params.address,
      params.coordinates ?? null,
    );
  }

  update(params: {
    province: string;
    municipality: string;
    neighborhood?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  }): void {
    this._address = Address.create({
      province: params.province,
      municipality: params.municipality,
      neighborhood: params.neighborhood,
      street: params.address,
      district: null,
    });
    this._coordinates = SchoolLocation.resolveCoordinates(
      params.latitude,
      params.longitude,
    );
  }

  belongsToSchool(schoolId: string): boolean {
    return this._schoolId === schoolId;
  }

  toSnapshot(): SchoolLocationSnapshot {
    return {
      id: this._id,
      schoolId: this._schoolId,
      province: this._address.province,
      municipality: this._address.municipality,
      neighborhood: this._address.neighborhood,
      address: this._address.street,
      latitude: this._coordinates?.latitude ?? null,
      longitude: this._coordinates?.longitude ?? null,
    };
  }

  get id(): string {
    return this._id;
  }

  get schoolId(): string {
    return this._schoolId;
  }

  get address(): Address {
    return this._address;
  }

  get coordinates(): Coordinates | null {
    return this._coordinates;
  }

  private static resolveCoordinates(
    latitude?: number | null,
    longitude?: number | null,
  ): Coordinates | null {
    const latMissing = latitude === undefined || latitude === null;
    const lngMissing = longitude === undefined || longitude === null;

    if (latMissing && lngMissing) {
      return null;
    }

    if (latMissing || lngMissing) {
      throw new InvalidSchoolLocationException(
        'latitude and longitude must both be provided or both be null',
      );
    }

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new InvalidSchoolLocationException(
        'latitude and longitude must be numbers',
      );
    }

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      throw new InvalidSchoolLocationException(
        'latitude and longitude cannot be NaN',
      );
    }

    try {
      return Coordinates.create(latitude, longitude);
    } catch (error) {
      throw new InvalidSchoolLocationException(
        error instanceof Error ? error.message : 'Invalid coordinates',
      );
    }
  }
}
