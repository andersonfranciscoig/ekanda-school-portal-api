import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  SchoolNotFoundException,
  SchoolOnboardingIncompleteException,
} from '../../domain/exceptions/school.exceptions';
import {
  SCHOOL_REPOSITORY,
  SchoolRepository,
} from '../../domain/repositories/school.repository';
import { SchoolStatus } from '../../domain/school.enums';
import {
  incompleteOnboardingStepKeys,
  SchoolOnboardingReview,
} from '../../domain/services/school-onboarding.evaluator';
import { ActivateSchoolFreePlanUseCase } from '../../../billing/application/use-cases/activate-school-free-plan.use-case';
import { SubscriptionDashboardDto } from '../../../billing/domain/services/subscription-access.service';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';
import { GetSchoolOnboardingReviewUseCase } from './get-school-onboarding-review.use-case';

export type CompleteSchoolOnboardingInput = {
  schoolId: string;
  userId: string;
};

export type CompleteSchoolOnboardingOutput = {
  schoolId: string;
  status: SchoolStatus;
  review: SchoolOnboardingReview;
  subscription: SubscriptionDashboardDto;
};

@Injectable()
export class CompleteSchoolOnboardingUseCase
  implements
    UseCase<CompleteSchoolOnboardingInput, CompleteSchoolOnboardingOutput>
{
  constructor(
    private readonly getReview: GetSchoolOnboardingReviewUseCase,
    @Inject(SCHOOL_REPOSITORY)
    private readonly schools: SchoolRepository,
    private readonly access: SchoolAccessAuthorizer,
    private readonly activateFreePlan: ActivateSchoolFreePlanUseCase,
  ) {}

  async execute(
    input: CompleteSchoolOnboardingInput,
  ): Promise<CompleteSchoolOnboardingOutput> {
    // Auth is enforced inside getReview (exists + OWNER/ADMIN ACTIVE).
    const review = await this.getReview.execute({
      schoolId: input.schoolId,
      userId: input.userId,
    });

    if (!review.canSubmit) {
      throw new SchoolOnboardingIncompleteException(
        incompleteOnboardingStepKeys(review),
        review,
      );
    }

    const school = await this.schools.findById(input.schoolId);
    if (!school) {
      throw new SchoolNotFoundException();
    }

    await this.access.assertCanManageSchool(input.userId, input.schoolId);

    const freePlanResult = await this.activateFreePlan.execute({
      schoolId: input.schoolId,
    });

    return {
      schoolId: freePlanResult.schoolId,
      status: freePlanResult.schoolStatus,
      review: {
        ...review,
        status: freePlanResult.schoolStatus,
      },
      subscription: freePlanResult.subscription,
    };
  }
}
