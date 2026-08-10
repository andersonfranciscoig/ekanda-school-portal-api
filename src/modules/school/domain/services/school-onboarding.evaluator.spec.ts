import {
  evaluateSchoolOnboarding,
  incompleteOnboardingStepKeys,
  SchoolOnboardingSnapshot,
} from './school-onboarding.evaluator';
import {
  EducationLevelCode,
  GalleryKind,
  SchoolClassShift,
  SchoolStatus,
} from '../school.enums';

function baseSnapshot(
  overrides: Partial<SchoolOnboardingSnapshot> = {},
): SchoolOnboardingSnapshot {
  return {
    schoolId: 'sch_01',
    status: SchoolStatus.DRAFT,
    name: '',
    description: null,
    servicesConfiguredAt: null,
    location: null,
    educationLevels: [],
    classes: [],
    price: null,
    gallery: [],
    ...overrides,
  };
}

const completeSnapshot = (): SchoolOnboardingSnapshot =>
  baseSnapshot({
    name: 'Colégio Horizonte',
    description: 'Descrição',
    servicesConfiguredAt: new Date(),
    location: { province: 'Luanda', municipality: 'Belas' },
    educationLevels: [EducationLevelCode.CRECHE, EducationLevelCode.MEDIO],
    classes: [
      {
        classLabel: '7.ª',
        vacancies: 20,
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
        {
          levelId: EducationLevelCode.MEDIO,
          tuitionFeeMin: 3000,
          tuitionFeeMax: null,
        },
      ],
    },
    gallery: [{ kind: GalleryKind.PHOTO }],
  });

describe('evaluateSchoolOnboarding', () => {
  it('evaluates empty onboarding', () => {
    const review = evaluateSchoolOnboarding(baseSnapshot());
    expect(review.completedSteps).toBe(0);
    expect(review.completionPercent).toBe(0);
    expect(review.canSubmit).toBe(false);
    expect(review.steps.basicInfo.missingFields).toEqual([
      'name',
      'description',
    ]);
  });

  it('marks only basicInfo complete', () => {
    const review = evaluateSchoolOnboarding(
      baseSnapshot({ name: 'Escola', description: 'Desc' }),
    );
    expect(review.steps.basicInfo.completed).toBe(true);
    expect(review.completedSteps).toBe(1);
    expect(review.completionPercent).toBe(17);
  });

  it('location incomplete without province/municipality', () => {
    const review = evaluateSchoolOnboarding(
      baseSnapshot({
        location: { province: '', municipality: 'Belas' },
      }),
    );
    expect(review.steps.location.completed).toBe(false);
    expect(review.steps.location.missingFields).toContain('province');
  });

  it('education levels without classes', () => {
    const review = evaluateSchoolOnboarding(
      baseSnapshot({
        educationLevels: [EducationLevelCode.PRIMARIO],
        classes: [],
      }),
    );
    expect(review.steps.educationOffer).toEqual({
      completed: false,
      missingFields: ['classes'],
    });
  });

  it('classes without education levels', () => {
    const review = evaluateSchoolOnboarding(
      baseSnapshot({
        educationLevels: [],
        classes: [
          {
            classLabel: '5.ª',
            vacancies: 10,
            shift: SchoolClassShift.AFTERNOON,
          },
        ],
      }),
    );
    expect(review.steps.educationOffer).toEqual({
      completed: false,
      missingFields: ['levels'],
    });
  });

  it('services configured even with empty list', () => {
    const review = evaluateSchoolOnboarding(
      baseSnapshot({ servicesConfiguredAt: new Date() }),
    );
    expect(review.steps.services.completed).toBe(true);
  });

  it('services incomplete when never configured', () => {
    const review = evaluateSchoolOnboarding(
      baseSnapshot({ servicesConfiguredAt: null }),
    );
    expect(review.steps.services).toEqual({
      completed: false,
      missingFields: ['services'],
    });
  });

  it('prices incomplete without SchoolPrice', () => {
    const review = evaluateSchoolOnboarding(
      baseSnapshot({
        educationLevels: [EducationLevelCode.CRECHE],
        price: null,
      }),
    );
    expect(review.steps.prices.missingFields).toContain('price');
  });

  it('prices incomplete when a school level has no price', () => {
    const review = evaluateSchoolOnboarding(
      baseSnapshot({
        educationLevels: [
          EducationLevelCode.CRECHE,
          EducationLevelCode.MEDIO,
        ],
        price: {
          currency: 'AOA',
          levels: [
            {
              levelId: EducationLevelCode.CRECHE,
              tuitionFeeMin: 1,
              tuitionFeeMax: 2,
            },
          ],
        },
      }),
    );
    expect(review.steps.prices.completed).toBe(false);
    expect(review.steps.prices.missingFields).toContain('price:medio');
  });

  it('gallery incomplete without photos', () => {
    const review = evaluateSchoolOnboarding(baseSnapshot({ gallery: [] }));
    expect(review.steps.gallery).toEqual({
      completed: false,
      missingFields: ['photos'],
    });
  });

  it('gallery incomplete with only video', () => {
    const review = evaluateSchoolOnboarding(
      baseSnapshot({ gallery: [{ kind: GalleryKind.VIDEO }] }),
    );
    expect(review.steps.gallery.completed).toBe(false);
  });

  it('onboarding 100% complete', () => {
    const review = evaluateSchoolOnboarding(completeSnapshot());
    expect(review.completedSteps).toBe(6);
    expect(review.completionPercent).toBe(100);
    expect(review.canSubmit).toBe(true);
    expect(incompleteOnboardingStepKeys(review)).toEqual([]);
  });
});
