import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ForbiddenDomainException } from '../../../../shared/domain/exceptions/domain.exception';
import {
  ReviewIdentityRequiredException,
  ReviewNotFoundException,
} from '../../domain/exceptions/marketplace.exceptions';
import {
  REVIEW_REPOSITORY,
  ReviewRepository,
} from '../../domain/marketplace.domain';

export type DeleteReviewInput = {
  reviewId: string;
  userId?: string | null;
  deviceId?: string | null;
};

@Injectable()
export class DeleteReviewUseCase
  implements UseCase<DeleteReviewInput, { removed: boolean }>
{
  constructor(
    @Inject(REVIEW_REPOSITORY)
    private readonly reviews: ReviewRepository,
  ) {}

  async execute(input: DeleteReviewInput) {
    if (!input.userId && !input.deviceId?.trim()) {
      throw new ReviewIdentityRequiredException();
    }
    const review = await this.reviews.findById(input.reviewId);
    if (!review) throw new ReviewNotFoundException();
    if (!review.belongsTo({ userId: input.userId, deviceId: input.deviceId })) {
      throw new ForbiddenDomainException('You can only delete your own review');
    }
    await this.reviews.delete(review.id);
    return { removed: true };
  }
}
