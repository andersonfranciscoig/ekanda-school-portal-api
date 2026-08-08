export class Student {
  private constructor(
    private readonly _id: string,
    private readonly _guardianId: string,
    private _firstName: string,
    private _lastName: string,
    private _birthDate: Date,
    private _gender: string | null,
    private _documentNumber: string | null,
    private _photoUrl: string | null,
  ) {}

  static create(params: {
    id: string;
    guardianId: string;
    firstName: string;
    lastName: string;
    birthDate: Date;
    gender?: string | null;
    documentNumber?: string | null;
    photoUrl?: string | null;
  }): Student {
    return new Student(
      params.id,
      params.guardianId,
      params.firstName.trim(),
      params.lastName.trim(),
      params.birthDate,
      params.gender ?? null,
      params.documentNumber ?? null,
      params.photoUrl ?? null,
    );
  }

  static rehydrate(params: {
    id: string;
    guardianId: string;
    firstName: string;
    lastName: string;
    birthDate: Date;
    gender: string | null;
    documentNumber: string | null;
    photoUrl: string | null;
  }): Student {
    return new Student(
      params.id,
      params.guardianId,
      params.firstName,
      params.lastName,
      params.birthDate,
      params.gender,
      params.documentNumber,
      params.photoUrl,
    );
  }

  get id(): string {
    return this._id;
  }

  get guardianId(): string {
    return this._guardianId;
  }

  get firstName(): string {
    return this._firstName;
  }

  get lastName(): string {
    return this._lastName;
  }

  update(params: {
    firstName?: string;
    lastName?: string;
    birthDate?: Date;
    gender?: string | null;
    documentNumber?: string | null;
    photoUrl?: string | null;
  }): void {
    if (params.firstName !== undefined) this._firstName = params.firstName.trim();
    if (params.lastName !== undefined) this._lastName = params.lastName.trim();
    if (params.birthDate !== undefined) this._birthDate = params.birthDate;
    if (params.gender !== undefined) this._gender = params.gender;
    if (params.documentNumber !== undefined) {
      this._documentNumber = params.documentNumber;
    }
    if (params.photoUrl !== undefined) this._photoUrl = params.photoUrl;
  }

  belongsToGuardian(guardianId: string): boolean {
    return this._guardianId === guardianId;
  }
}
