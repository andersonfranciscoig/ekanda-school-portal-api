import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { SchoolNotFoundException } from '../../domain/exceptions/school.exceptions';
import {
  SCHOOL_ONBOARDING_QUERY,
  SchoolOnboardingQuery,
} from '../../domain/repositories/school-onboarding.query';
import {
  evaluateSchoolOnboarding,
  SchoolOnboardingReview,
} from '../../domain/services/school-onboarding.evaluator';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';

export type GetSchoolOnboardingReviewInput = {
  schoolId: string;
  userId: string;
};

export type GetSchoolOnboardingReviewOutput = SchoolOnboardingReview;

@Injectable()
export class GetSchoolOnboardingReviewUseCase
  implements
    UseCase<GetSchoolOnboardingReviewInput, GetSchoolOnboardingReviewOutput>
{
  constructor(
    @Inject(SCHOOL_ONBOARDING_QUERY)
    private readonly onboardingQuery: SchoolOnboardingQuery,
    private readonly access: SchoolAccessAuthorizer,
  ) {}

  async execute(
    input: GetSchoolOnboardingReviewInput,
  ): Promise<GetSchoolOnboardingReviewOutput> {
    await this.access.assertSchoolExists(input.schoolId);
    await this.access.assertCanManageSchool(input.userId, input.schoolId);

    const snapshot = await this.onboardingQuery.findSnapshot(input.schoolId);
    if (!snapshot) {
      throw new SchoolNotFoundException();
    }

    return evaluateSchoolOnboarding(snapshot);
  }
}
