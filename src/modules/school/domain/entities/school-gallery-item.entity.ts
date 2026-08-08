export class SchoolGalleryItem {
  private constructor(
    private readonly _id: string,
    private _url: string,
    private _type: string,
    private _caption: string | null,
    private _sortOrder: number,
  ) {}

  static create(params: {
    id: string;
    url: string;
    type: string;
    caption?: string | null;
    sortOrder?: number;
  }): SchoolGalleryItem {
    return new SchoolGalleryItem(
      params.id,
      params.url,
      params.type,
      params.caption ?? null,
      params.sortOrder ?? 0,
    );
  }

  get id(): string {
    return this._id;
  }

  get url(): string {
    return this._url;
  }
}
