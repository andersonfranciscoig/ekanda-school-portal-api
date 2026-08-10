import { buildSchoolOnboardingProgress } from './school-onboarding.progress';
import {
  EducationLevelCode,
  GalleryKind,
  SchoolClassShift,
  SchoolStatus,
} from '../domain/school.enums';

describe('buildSchoolOnboardingProgress', () => {
  const base = {
    id: 'sch_01',
    status: SchoolStatus.DRAFT,
    name: 'Colégio Horizonte',
    description: 'Escola de excelência',
    servicesConfiguredAt: null as Date | null,
    location: { province: 'Luanda', municipality: 'Belas' },
    educationLevels: [{ level: EducationLevelCode.CRECHE }],
    classes: [
      {
        classLabel: 'Creche A',
        vacancies: 10,
        shift: SchoolClassShift.MORNING,
      },
    ],
    price: null as null | {
      currency: string;
      levels: Array<{
        levelId: EducationLevelCode;
        tuitionFeeMin: number | null;
        tuitionFeeMax: number | null;
      }>;
    },
    gallery: [] as Array<{ kind: GalleryKind }>,
  };

  it('marks first three steps when basic/location/education done', () => {
    const progress = buildSchoolOnboardingProgress(base);
    expect(progress.basicInfo).toBe(true);
    expect(progress.location).toBe(true);
    expect(progress.educationOffer).toBe(true);
    expect(progress.services).toBe(false);
    expect(progress.completionPercent).toBe(50);
  });

  it('basicInfo false without description', () => {
    const progress = buildSchoolOnboardingProgress({
      ...base,
      description: null,
    });
    expect(progress.basicInfo).toBe(false);
  });

  it('services true when configured flag is set', () => {
    const progress = buildSchoolOnboardingProgress({
      ...base,
      servicesConfiguredAt: new Date(),
    });
    expect(progress.services).toBe(true);
  });

  it('returns 100 when all steps complete', () => {
    const progress = buildSchoolOnboardingProgress({
      ...base,
      servicesConfiguredAt: new Date(),
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
    });
    expect(progress.completionPercent).toBe(100);
  });
});
