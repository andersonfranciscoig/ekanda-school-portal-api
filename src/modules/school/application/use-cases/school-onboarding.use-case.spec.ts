import { School } from '../../domain/aggregates/school.aggregate';
import {
  SchoolAccessDeniedException,
  SchoolNotFoundException,
  SchoolOnboardingIncompleteException,
} from '../../domain/exceptions/school.exceptions';
import {
  EducationLevelCode,
  GalleryKind,
  SchoolClassShift,
  SchoolMembershipRole,
  SchoolStatus,
} from '../../domain/school.enums';
import { SchoolSlug } from '../../domain/value-objects/school-slug.vo';
import { evaluateSchoolOnboarding } from '../../domain/services/school-onboarding.evaluator';
import { ActivateSchoolFreePlanUseCase } from '../../../billing/application/use-cases/activate-school-free-plan.use-case';
import { PlanCode } from '../../../billing/domain/entities/plan.entity';
import { SubscriptionStatus } from '../../../billing/domain/aggregates/subscription.aggregate';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';
import { CompleteSchoolOnboardingUseCase } from './complete-school-onboarding.use-case';
import { GetSchoolOnboardingReviewUseCase } from './get-school-onboarding-review.use-case';

describe('School onboarding use cases', () => {
  const schoolId = '11111111-1111-1111-1111-111111111111';
  const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  let onboardingQuery: { findSnapshot: jest.Mock };
  let schools: { findById: jest.Mock; save: jest.Mock };
  let access: {
    assertSchoolExists: jest.Mock;
    assertCanManageSchool: jest.Mock;
  };
  let activateFreePlan: { execute: jest.Mock };
  let getReview: GetSchoolOnboardingReviewUseCase;
  let complete: CompleteSchoolOnboardingUseCase;

  let school: School;

  const completeSnapshot = {
    schoolId,
    status: SchoolStatus.DRAFT,
    name: 'Colégio Horizonte',
    description: 'Descrição válida',
    servicesConfiguredAt: new Date(),
    location: { province: 'Luanda', municipality: 'Belas' },
    educationLevels: [EducationLevelCode.CRECHE],
    classes: [
      {
        classLabel: 'Creche A',
        vacancies: 10,
        shift: SchoolClassShift.MORNING,
      },
    ],
    price: {
      currency: 'AOA',
      levels: [
        {
          levelId: EducationLevelCode.CRECHE,
          tuitionFeeMin: 1000,
          tuitionFeeMax: 2000,
        },
      ],
    },
    gallery: [{ kind: GalleryKind.PHOTO }],
  };

  const freeSubscriptionDto = {
    planId: 'plan-free',
    planCode: PlanCode.FREE,
    planName: 'Plano Gratuito',
    status: SubscriptionStatus.ACTIVE,
    startDate: '2026-08-10T10:00:00.000Z',
    endDate: '2026-09-09T10:00:00.000Z',
    daysRemaining: 30,
    isFree: true,
    isExpired: false,
  };

  beforeEach(() => {
    school = School.create({
      id: schoolId,
      name: 'Colégio Horizonte',
      slug: SchoolSlug.create('colegio-horizonte'),
      ownerUserId: userId,
      description: 'Descrição válida',
    });
    onboardingQuery = {
      findSnapshot: jest.fn().mockResolvedValue(completeSnapshot),
    };
    schools = {
      findById: jest.fn().mockResolvedValue(school),
      save: jest.fn().mockResolvedValue(undefined),
    };
    access = {
      assertSchoolExists: jest.fn().mockResolvedValue(school),
      assertCanManageSchool: jest.fn().mockResolvedValue({
        userId,
        schoolId,
        role: SchoolMembershipRole.OWNER,
        status: 'ACTIVE',
      }),
    };
    activateFreePlan = {
      execute: jest.fn().mockResolvedValue({
        schoolId,
        schoolStatus: SchoolStatus.DRAFT,
        subscription: freeSubscriptionDto,
        created: true,
      }),
    };
    getReview = new GetSchoolOnboardingReviewUseCase(
      onboardingQuery as never,
      access as unknown as SchoolAccessAuthorizer,
    );
    const submitForActivation = {
      execute: jest.fn().mockResolvedValue({
        schoolId,
        status: SchoolStatus.PENDING_REVIEW,
      }),
    };
    complete = new CompleteSchoolOnboardingUseCase(
      getReview,
      schools as never,
      access as unknown as SchoolAccessAuthorizer,
      activateFreePlan as unknown as ActivateSchoolFreePlanUseCase,
      submitForActivation as never,
    );
  });

  describe('GetSchoolOnboardingReviewUseCase', () => {
    it('returns evaluated review', async () => {
      const review = await getReview.execute({ schoolId, userId });
      expect(review.canSubmit).toBe(true);
      expect(review.completionPercent).toBe(100);
    });

    it('rejects user without membership', async () => {
      access.assertCanManageSchool.mockRejectedValue(
        new SchoolAccessDeniedException(),
      );
      await expect(
        getReview.execute({ schoolId, userId }),
      ).rejects.toBeInstanceOf(SchoolAccessDeniedException);
    });

    it('rejects cross-tenant school', async () => {
      access.assertCanManageSchool.mockRejectedValue(
        new SchoolAccessDeniedException(),
      );
      await expect(
        getReview.execute({
          schoolId: '22222222-2222-2222-2222-222222222222',
          userId,
        }),
      ).rejects.toBeInstanceOf(SchoolAccessDeniedException);
    });
  });

  describe('CompleteSchoolOnboardingUseCase', () => {
    it('does not allow incomplete onboarding', async () => {
      onboardingQuery.findSnapshot.mockResolvedValue({
        ...completeSnapshot,
        gallery: [],
      });

      await expect(
        complete.execute({ schoolId, userId }),
      ).rejects.toBeInstanceOf(SchoolOnboardingIncompleteException);
      expect(activateFreePlan.execute).not.toHaveBeenCalled();
    });

    it('reports pending steps on incomplete', async () => {
      onboardingQuery.findSnapshot.mockResolvedValue({
        ...completeSnapshot,
        gallery: [],
        price: null,
      });

      try {
        await complete.execute({ schoolId, userId });
        fail('expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(SchoolOnboardingIncompleteException);
        const incomplete = error as SchoolOnboardingIncompleteException;
        expect(incomplete.incompleteSteps).toEqual(
          expect.arrayContaining(['prices', 'gallery']),
        );
        expect(incomplete.review?.canSubmit).toBe(false);
        expect(incomplete.review?.steps.prices.completed).toBe(false);
        expect(incomplete.review?.steps.gallery.completed).toBe(false);
      }
    });

    it('changes DRAFT → PENDING_REVIEW with FREE subscription', async () => {
      const result = await complete.execute({ schoolId, userId });
      expect(result.status).toBe(SchoolStatus.PENDING_REVIEW);
      expect(result.subscription.planCode).toBe(PlanCode.FREE);
      expect(result.subscription.daysRemaining).toBe(30);
      expect(activateFreePlan.execute).toHaveBeenCalledWith({ schoolId });
    });

    it('is idempotent when free plan already active', async () => {
      activateFreePlan.execute.mockResolvedValue({
        schoolId,
        schoolStatus: SchoolStatus.DRAFT,
        subscription: freeSubscriptionDto,
        created: false,
      });

      const result = await complete.execute({ schoolId, userId });
      expect(result.status).toBe(SchoolStatus.PENDING_REVIEW);
      expect(activateFreePlan.execute).toHaveBeenCalledTimes(1);
    });

    it('does not downgrade ACTIVE', async () => {
      (school as unknown as { _status: SchoolStatus })._status =
        SchoolStatus.ACTIVE;
      activateFreePlan.execute.mockResolvedValue({
        schoolId,
        schoolStatus: SchoolStatus.ACTIVE,
        subscription: freeSubscriptionDto,
        created: false,
      });

      const result = await complete.execute({ schoolId, userId });
      expect(result.status).toBe(SchoolStatus.ACTIVE);
    });

    it('rejects school not found on write', async () => {
      schools.findById.mockResolvedValue(null);
      await expect(
        complete.execute({ schoolId, userId }),
      ).rejects.toBeInstanceOf(SchoolNotFoundException);
      expect(activateFreePlan.execute).not.toHaveBeenCalled();
    });
  });

  it('evaluate helper matches complete snapshot', () => {
    expect(evaluateSchoolOnboarding(completeSnapshot).canSubmit).toBe(true);
  });
});
