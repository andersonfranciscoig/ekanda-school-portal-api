import {
  EducationLevelCode,
  GalleryKind,
  SCHOOL_PRICES_CURRENCY,
  SchoolClassShift,
  SchoolStatus,
} from '../school.enums';

export const SCHOOL_ONBOARDING_TOTAL_STEPS = 6;

export type OnboardingStepResult = {
  completed: boolean;
  missingFields: string[];
};

export type SchoolOnboardingSnapshot = {
  schoolId: string;
  status: SchoolStatus;
  name: string;
  description: string | null;
  servicesConfiguredAt: Date | null;
  location: {
    province: string;
    municipality: string;
  } | null;
  educationLevels: EducationLevelCode[];
  classes: Array<{
    classLabel: string;
    vacancies: number;
    shift: string;
  }>;
  price: {
    currency: string;
    levels: Array<{
      levelId: EducationLevelCode;
      tuitionFeeMin: number | null;
      tuitionFeeMax: number | null;
    }>;
  } | null;
  gallery: Array<{ kind: GalleryKind | string }>;
};

export type SchoolOnboardingReview = {
  schoolId: string;
  steps: {
    basicInfo: OnboardingStepResult;
    location: OnboardingStepResult;
    educationOffer: OnboardingStepResult;
    services: OnboardingStepResult;
    prices: OnboardingStepResult;
    gallery: OnboardingStepResult;
  };
  completedSteps: number;
  totalSteps: number;
  completionPercent: number;
  canSubmit: boolean;
  status: SchoolStatus;
};

function step(
  completed: boolean,
  missingFields: string[] = [],
): OnboardingStepResult {
  return {
    completed,
    missingFields: completed ? [] : missingFields,
  };
}

function evaluateBasicInfo(
  snapshot: SchoolOnboardingSnapshot,
): OnboardingStepResult {
  const missing: string[] = [];
  if (!snapshot.name?.trim()) missing.push('name');
  if (!snapshot.description?.trim()) missing.push('description');
  return step(missing.length === 0, missing);
}

function evaluateLocation(
  snapshot: SchoolOnboardingSnapshot,
): OnboardingStepResult {
  if (!snapshot.location) {
    return step(false, ['location']);
  }
  const missing: string[] = [];
  if (!snapshot.location.province?.trim()) missing.push('province');
  if (!snapshot.location.municipality?.trim()) missing.push('municipality');
  return step(missing.length === 0, missing);
}

function isValidClass(c: SchoolOnboardingSnapshot['classes'][number]): boolean {
  const labelOk = Boolean(c.classLabel?.trim());
  const vacanciesOk =
    typeof c.vacancies === 'number' &&
    Number.isInteger(c.vacancies) &&
    c.vacancies >= 0;
  const shiftOk = Object.values(SchoolClassShift).includes(
    c.shift as SchoolClassShift,
  );
  return labelOk && vacanciesOk && shiftOk;
}

function evaluateEducationOffer(
  snapshot: SchoolOnboardingSnapshot,
): OnboardingStepResult {
  const hasLevels = snapshot.educationLevels.length > 0;
  const hasValidClass = snapshot.classes.some(isValidClass);
  const missing: string[] = [];
  if (!hasLevels) missing.push('levels');
  if (!hasValidClass) missing.push('classes');
  return step(missing.length === 0, missing);
}

function evaluateServices(
  snapshot: SchoolOnboardingSnapshot,
): OnboardingStepResult {
  if (snapshot.servicesConfiguredAt != null) {
    return step(true);
  }
  return step(false, ['services']);
}

function hasValidTuition(
  min: number | null,
  max: number | null,
): boolean {
  if (min == null && max == null) return false;
  if (min != null && min < 0) return false;
  if (max != null && max < 0) return false;
  if (min != null && max != null && min > max) return false;
  return true;
}

function evaluatePrices(
  snapshot: SchoolOnboardingSnapshot,
): OnboardingStepResult {
  if (!snapshot.price) {
    return step(false, ['price']);
  }

  const missing: string[] = [];
  if (snapshot.price.currency !== SCHOOL_PRICES_CURRENCY) {
    missing.push('currency');
  }

  const priced = new Map(
    snapshot.price.levels.map((level) => [level.levelId, level]),
  );

  for (const levelId of snapshot.educationLevels) {
    const row = priced.get(levelId);
    if (!row) {
      missing.push(`price:${levelId}`);
      continue;
    }
    if (!hasValidTuition(row.tuitionFeeMin, row.tuitionFeeMax)) {
      missing.push(`tuitionFee:${levelId}`);
    }
  }

  return step(missing.length === 0, missing);
}

function evaluateGallery(
  snapshot: SchoolOnboardingSnapshot,
): OnboardingStepResult {
  const hasPhoto = snapshot.gallery.some(
    (item) =>
      item.kind === GalleryKind.PHOTO ||
      item.kind === 'PHOTO' ||
      item.kind === 'photo',
  );
  return step(hasPhoto, hasPhoto ? [] : ['photos']);
}

export function evaluateSchoolOnboarding(
  snapshot: SchoolOnboardingSnapshot,
): SchoolOnboardingReview {
  const steps = {
    basicInfo: evaluateBasicInfo(snapshot),
    location: evaluateLocation(snapshot),
    educationOffer: evaluateEducationOffer(snapshot),
    services: evaluateServices(snapshot),
    prices: evaluatePrices(snapshot),
    gallery: evaluateGallery(snapshot),
  };

  const completedSteps = Object.values(steps).filter((s) => s.completed).length;
  const totalSteps = SCHOOL_ONBOARDING_TOTAL_STEPS;
  const completionPercent = Math.round((completedSteps / totalSteps) * 100);
  const canSubmit = completedSteps === totalSteps;

  return {
    schoolId: snapshot.schoolId,
    steps,
    completedSteps,
    totalSteps,
    completionPercent,
    canSubmit,
    status: snapshot.status,
  };
}

export function incompleteOnboardingStepKeys(
  review: SchoolOnboardingReview,
): string[] {
  return (Object.keys(review.steps) as Array<keyof typeof review.steps>).filter(
    (key) => !review.steps[key].completed,
  );
}
