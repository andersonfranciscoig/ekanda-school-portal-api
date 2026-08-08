export class SchoolClass {
  private constructor(
    private readonly _id: string,
    private _name: string,
    private _description: string | null,
    private _isActive: boolean,
  ) {}

  static create(params: {
    id: string;
    name: string;
    description?: string | null;
    isActive?: boolean;
  }): SchoolClass {
    return new SchoolClass(
      params.id,
      params.name.trim(),
      params.description?.trim() || null,
      params.isActive ?? true,
    );
  }

  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get description(): string | null {
    return this._description;
  }

  get isActive(): boolean {
    return this._isActive;
  }
}
