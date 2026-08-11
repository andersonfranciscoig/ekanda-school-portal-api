import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import {
  InvalidReviewRatingException,
  ReviewIdentityRequiredException,
} from '../../domain/exceptions/marketplace.exceptions';
import {
  Review,
  REVIEW_REPOSITORY,
  ReviewRepository,
} from '../../domain/marketplace.domain';
import { assertSchoolIsPubliclyListed } from '../services/school-public-eligibility';

export type CreateOrUpdateReviewInput = {
  schoolId: string;
  rating: number;
  comment?: string | null;
  anonymous?: boolean;
  userId?: string | null;
  deviceId?: string | null;
};

export type ReviewDto = {
  id: string;
  schoolId: string;
  rating: number;
  comment: string | null;
  isAnonymous: boolean;
  author: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  mine: boolean;
};

@Injectable()
export class CreateOrUpdateReviewUseCase
  implements UseCase<CreateOrUpdateReviewInput, ReviewDto & { created: boolean }>
{
  constructor(
    @Inject(REVIEW_REPOSITORY)
    private readonly reviews: ReviewRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: CreateOrUpdateReviewInput) {
    const rating = Number(input.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new InvalidReviewRatingException();
    }
    if (!input.userId && !input.deviceId?.trim()) {
      throw new ReviewIdentityRequiredException();
    }

    await assertSchoolIsPubliclyListed(this.prisma, input.schoolId);

    const deviceId = input.deviceId?.trim() || null;
    const isAnonymous = input.anonymous === true || !input.userId;
    const comment = input.comment?.trim() ? input.comment.trim() : null;

    const existing = input.userId
      ? await this.reviews.findByUserAndSchool(input.userId, input.schoolId)
      : await this.reviews.findByDeviceAndSchool(deviceId!, input.schoolId);

    if (existing) {
      existing.update({ rating, comment, isAnonymous });
      await this.reviews.save(existing);
      return {
        ...presentOwnedReview(existing),
        created: false,
      };
    }

    const { review } = Review.create({
      id: crypto.randomUUID(),
      userId: input.userId ?? null,
      deviceId: input.userId ? null : deviceId,
      schoolId: input.schoolId,
      rating,
      comment,
      isAnonymous,
    });
    await this.reviews.save(review);
    return {
      ...presentOwnedReview(review),
      created: true,
    };
  }
}

export function presentOwnedReview(review: Review): ReviewDto {
  return {
    id: review.id,
    schoolId: review.schoolId,
    rating: review.rating,
    comment: review.comment,
    isAnonymous: review.isAnonymous,
    author: null,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    mine: true,
  };
}
