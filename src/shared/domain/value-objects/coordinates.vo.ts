import { InvariantViolationException } from '../exceptions/domain.exception';

export class Coordinates {
  private constructor(
    private readonly _latitude: number,
    private readonly _longitude: number,
  ) {}

  static create(latitude: number, longitude: number): Coordinates {
    if (latitude < -90 || latitude > 90) {
      throw new InvariantViolationException('Latitude inválida');
    }
    if (longitude < -180 || longitude > 180) {
      throw new InvariantViolationException('Longitude inválida');
    }
    return new Coordinates(latitude, longitude);
  }

  get latitude(): number {
    return this._latitude;
  }

  get longitude(): number {
    return this._longitude;
  }
}
