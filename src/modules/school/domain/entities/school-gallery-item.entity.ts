import { GalleryKind } from '../school.enums';
import { InvalidSchoolGalleryException } from '../exceptions/school.exceptions';

export type SchoolGalleryItemSnapshot = {
  id: string;
  schoolId: string;
  url: string;
  kind: GalleryKind;
  order: number;
  fileName: string | null;
};

export class SchoolGalleryItem {
  private constructor(
    private readonly _id: string,
    private readonly _schoolId: string,
    private _url: string,
    private _kind: GalleryKind,
    private _order: number,
    private _fileName: string | null,
  ) {}

  static create(params: {
    id: string;
    schoolId: string;
    url: string;
    kind: GalleryKind;
    order: number;
    fileName?: string | null;
  }): SchoolGalleryItem {
    const schoolId = params.schoolId?.trim();
    if (!schoolId) {
      throw new InvalidSchoolGalleryException('schoolId is required');
    }
    const url = params.url?.trim();
    if (!url) {
      throw new InvalidSchoolGalleryException('url is required');
    }
    if (!Object.values(GalleryKind).includes(params.kind)) {
      throw new InvalidSchoolGalleryException('Invalid gallery kind');
    }
    if (!Number.isInteger(params.order) || params.order < 0) {
      throw new InvalidSchoolGalleryException(
        'order must be a non-negative integer',
      );
    }

    return new SchoolGalleryItem(
      params.id,
      schoolId,
      url,
      params.kind,
      params.order,
      params.fileName?.trim() || null,
    );
  }

  static rehydrate(params: SchoolGalleryItemSnapshot): SchoolGalleryItem {
    return new SchoolGalleryItem(
      params.id,
      params.schoolId,
      params.url,
      params.kind,
      params.order,
      params.fileName,
    );
  }

  belongsToSchool(schoolId: string): boolean {
    return this._schoolId === schoolId;
  }

  toSnapshot(): SchoolGalleryItemSnapshot {
    return {
      id: this._id,
      schoolId: this._schoolId,
      url: this._url,
      kind: this._kind,
      order: this._order,
      fileName: this._fileName,
    };
  }

  get id(): string {
    return this._id;
  }

  get schoolId(): string {
    return this._schoolId;
  }

  get url(): string {
    return this._url;
  }

  get kind(): GalleryKind {
    return this._kind;
  }

  get order(): number {
    return this._order;
  }

  get fileName(): string | null {
    return this._fileName;
  }

  get type(): string {
    return this._kind === GalleryKind.VIDEO ? 'VIDEO' : 'IMAGE';
  }
}
