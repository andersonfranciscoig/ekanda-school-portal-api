import { DomainEvent } from '../../../shared/domain/events/domain-event';

export class ReviewCreatedEvent extends DomainEvent {
  constructor(
    reviewId: string,
    public readonly schoolId: string,
    public readonly userId: string,
    public readonly rating: number,
  ) {
    super(reviewId, 'review.created');
  }
}

export class Review {
  private constructor(
    private readonly _id: string,
    private readonly _userId: string,
    private readonly _schoolId: string,
    private _rating: number,
    private _comment: string | null,
    private _isPublished: boolean,
  ) {}

  static create(params: {
    id: string;
    userId: string;
    schoolId: string;
    rating: number;
    comment?: string | null;
  }): { review: Review; event: ReviewCreatedEvent } {
    if (params.rating < 1 || params.rating > 5) {
      throw new Error('Rating deve estar entre 1 e 5');
    }
    const review = new Review(
      params.id,
      params.userId,
      params.schoolId,
      params.rating,
      params.comment ?? null,
      false,
    );
    return {
      review,
      event: new ReviewCreatedEvent(
        params.id,
        params.schoolId,
        params.userId,
        params.rating,
      ),
    };
  }

  get id(): string {
    return this._id;
  }

  get schoolId(): string {
    return this._schoolId;
  }

  get rating(): number {
    return this._rating;
  }

  update(params: { rating?: number; comment?: string | null }): void {
    if (params.rating !== undefined) {
      if (params.rating < 1 || params.rating > 5) {
        throw new Error('Rating deve estar entre 1 e 5');
      }
      this._rating = params.rating;
    }
    if (params.comment !== undefined) this._comment = params.comment;
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
  }): Favorite {
    return new Favorite(params.id, params.userId, params.schoolId, new Date());
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
}

export const REVIEW_REPOSITORY = Symbol('REVIEW_REPOSITORY');
export const FAVORITE_REPOSITORY = Symbol('FAVORITE_REPOSITORY');

export interface ReviewRepository {
  save(review: Review): Promise<void>;
  findByUserAndSchool(userId: string, schoolId: string): Promise<Review | null>;
}

export interface FavoriteRepository {
  add(favorite: Favorite): Promise<void>;
  remove(userId: string, schoolId: string): Promise<void>;
  exists(userId: string, schoolId: string): Promise<boolean>;
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
