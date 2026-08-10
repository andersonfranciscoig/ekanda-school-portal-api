import {
  evaluateSchoolOnboarding,
  SchoolOnboardingSnapshot,
} from '../domain/services/school-onboarding.evaluator';
import {
  EducationLevelCode,
  GalleryKind,
  SchoolClassShift,
  SchoolStatus,
} from '../domain/school.enums';

export type SchoolOnboardingProgress = {
  basicInfo: boolean;
  location: boolean;
  educationOffer: boolean;
  services: boolean;
  prices: boolean;
  gallery: boolean;
  completionPercent: number;
};

export type MineOnboardingSource = {
  id: string;
  status: SchoolStatus | string;
  name: string;
  description: string | null;
  servicesConfiguredAt: Date | null;
  location: { province: string; municipality: string } | null;
  educationLevels: Array<{ level: EducationLevelCode | string }>;
  classes: Array<{
    classLabel: string;
    vacancies: number;
    shift: string;
  }>;
  price: {
    currency: string;
    levels: Array<{
      levelId: EducationLevelCode | string;
      tuitionFeeMin: number | null;
      tuitionFeeMax: number | null;
    }>;
  } | null;
  gallery: Array<{ kind: GalleryKind | string }>;
};

export function buildSchoolOnboardingProgress(
  source: MineOnboardingSource,
): SchoolOnboardingProgress {
  const snapshot: SchoolOnboardingSnapshot = {
    schoolId: source.id,
    status: source.status as SchoolStatus,
    name: source.name,
    description: source.description,
    servicesConfiguredAt: source.servicesConfiguredAt,
    location: source.location,
    educationLevels: source.educationLevels.map(
      (row) => row.level as EducationLevelCode,
    ),
    classes: source.classes.map((c) => ({
      classLabel: c.classLabel,
      vacancies: c.vacancies,
      shift: c.shift as SchoolClassShift,
    })),
    price: source.price
      ? {
          currency: source.price.currency,
          levels: source.price.levels.map((level) => ({
            levelId: level.levelId as EducationLevelCode,
            tuitionFeeMin: level.tuitionFeeMin,
            tuitionFeeMax: level.tuitionFeeMax,
          })),
        }
      : null,
    gallery: source.gallery.map((g) => ({
      kind: g.kind as GalleryKind,
    })),
  };

  const review = evaluateSchoolOnboarding(snapshot);
  return {
    basicInfo: review.steps.basicInfo.completed,
    location: review.steps.location.completed,
    educationOffer: review.steps.educationOffer.completed,
    services: review.steps.services.completed,
    prices: review.steps.prices.completed,
    gallery: review.steps.gallery.completed,
    completionPercent: review.completionPercent,
  };
}
