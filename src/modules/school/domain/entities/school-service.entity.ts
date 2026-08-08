export class SchoolServiceOffer {
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
  }): SchoolServiceOffer {
    return new SchoolServiceOffer(
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

  get isActive(): boolean {
    return this._isActive;
  }
}
