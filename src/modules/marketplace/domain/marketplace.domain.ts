import { DomainEvent } from '../../../shared/domain/events/domain-event';

export class ReviewCreatedEvent extends DomainEvent {
  constructor(
    reviewId: string,
    public readonly schoolId: string,
    public readonly userId: string | null,
    public readonly rating: number,
  ) {
    super(reviewId, 'review.created');
  }
}

export class Review {
  private constructor(
    private readonly _id: string,
    private readonly _userId: string | null,
    private readonly _deviceId: string | null,
    private readonly _schoolId: string,
    private _rating: number,
    private _comment: string | null,
    private _isAnonymous: boolean,
    private _isPublished: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static create(params: {
    id: string;
    userId?: string | null;
    deviceId?: string | null;
    schoolId: string;
    rating: number;
    comment?: string | null;
    isAnonymous?: boolean;
  }): { review: Review; event: ReviewCreatedEvent } {
    if (!Number.isInteger(params.rating) || params.rating < 1 || params.rating > 5) {
      throw new Error('Rating deve estar entre 1 e 5');
    }
    const now = new Date();
    const isAnonymous = params.isAnonymous ?? !params.userId;
    const review = new Review(
      params.id,
      params.userId ?? null,
      params.deviceId ?? null,
      params.schoolId,
      params.rating,
      params.comment ?? null,
      isAnonymous,
      true,
      now,
      now,
    );
    return {
      review,
      event: new ReviewCreatedEvent(
        params.id,
        params.schoolId,
        params.userId ?? null,
        params.rating,
      ),
    };
  }

  static rehydrate(params: {
    id: string;
    userId: string | null;
    deviceId: string | null;
    schoolId: string;
    rating: number;
    comment: string | null;
    isAnonymous: boolean;
    isPublished: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Review {
    return new Review(
      params.id,
      params.userId,
      params.deviceId,
      params.schoolId,
      params.rating,
      params.comment,
      params.isAnonymous,
      params.isPublished,
      params.createdAt,
      params.updatedAt,
    );
  }

  get id(): string {
    return this._id;
  }

  get userId(): string | null {
    return this._userId;
  }

  get deviceId(): string | null {
    return this._deviceId;
  }

  get schoolId(): string {
    return this._schoolId;
  }

  get rating(): number {
    return this._rating;
  }

  get comment(): string | null {
    return this._comment;
  }

  get isAnonymous(): boolean {
    return this._isAnonymous;
  }

  get isPublished(): boolean {
    return this._isPublished;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  update(params: {
    rating?: number;
    comment?: string | null;
    isAnonymous?: boolean;
  }): void {
    if (params.rating !== undefined) {
      if (!Number.isInteger(params.rating) || params.rating < 1 || params.rating > 5) {
        throw new Error('Rating deve estar entre 1 e 5');
      }
      this._rating = params.rating;
    }
    if (params.comment !== undefined) this._comment = params.comment;
    if (params.isAnonymous !== undefined) this._isAnonymous = params.isAnonymous;
    this._updatedAt = new Date();
  }

  belongsTo(actor: { userId?: string | null; deviceId?: string | null }): boolean {
    if (this._userId && actor.userId && this._userId === actor.userId) return true;
    if (this._deviceId && actor.deviceId && this._deviceId === actor.deviceId) {
      return true;
    }
    return false;
  }
}

export class Favorite {
  private constructor(
    private readonly _id: string,
    private readonly _userId: string,
    private readonly _schoolId: string,
    private readonly _createdAt: Date,
  ) {}

  static create(params: {
    id: string;
    userId: string;
    schoolId: string;
    createdAt?: Date;
  }): Favorite {
    return new Favorite(
      params.id,
      params.userId,
      params.schoolId,
      params.createdAt ?? new Date(),
    );
  }

  static rehydrate(params: {
    id: string;
    userId: string;
    schoolId: string;
    createdAt: Date;
  }): Favorite {
    return new Favorite(
      params.id,
      params.userId,
      params.schoolId,
      params.createdAt,
    );
  }

  get id(): string {
    return this._id;
  }

  get userId(): string {
    return this._userId;
  }

  get schoolId(): string {
    return this._schoolId;
  }

  get createdAt(): Date {
    return this._createdAt;
  }
}

export const REVIEW_REPOSITORY = Symbol('REVIEW_REPOSITORY');
export const FAVORITE_REPOSITORY = Symbol('FAVORITE_REPOSITORY');

export interface ReviewRepository {
  save(review: Review): Promise<void>;
  findById(id: string): Promise<Review | null>;
  findByUserAndSchool(userId: string, schoolId: string): Promise<Review | null>;
  findByDeviceAndSchool(
    deviceId: string,
    schoolId: string,
  ): Promise<Review | null>;
  delete(id: string): Promise<void>;
}

export interface FavoriteRepository {
  add(favorite: Favorite): Promise<Favorite>;
  remove(userId: string, schoolId: string): Promise<boolean>;
  exists(userId: string, schoolId: string): Promise<boolean>;
  findByUserAndSchool(
    userId: string,
    schoolId: string,
  ): Promise<Favorite | null>;
  listByUserId(userId: string): Promise<Favorite[]>;
}

/**
 * Preparação para motor de compatibilidade (concierge) — implementação futura.
 */
export class SchoolCompatibilityService {
  static score(_input: {
    schoolId: string;
    filters?: Record<string, unknown>;
  }): number {
    return 0;
  }
}
