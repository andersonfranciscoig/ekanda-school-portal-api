export type SchoolOnboardingProgress = {
  basicInfo: boolean;
  location: boolean;
  educationOffer: boolean;
  services: boolean;
  prices: boolean;
  gallery: boolean;
  completionPercent: number;
};

const ONBOARDING_STEPS = 6;

export type SchoolOnboardingSource = {
  name: string;
  description: string | null;
  location: { province: string; municipality: string } | null;
  educationLevels: unknown[];
  classes: unknown[];
  services: unknown[];
  price: unknown | null;
  gallery: unknown[];
};


export function buildSchoolOnboardingProgress(
  school: SchoolOnboardingSource,
): SchoolOnboardingProgress {
  const basicInfo = Boolean(school.name?.trim());
  const location = Boolean(
    school.location?.province?.trim() && school.location?.municipality?.trim(),
  );
  const educationOffer =
    (school.educationLevels?.length ?? 0) > 0 ||
    (school.classes?.length ?? 0) > 0;
  const services = (school.services?.length ?? 0) > 0;
  const prices = school.price != null;
  const gallery = (school.gallery?.length ?? 0) > 0;

  const completed = [
    basicInfo,
    location,
    educationOffer,
    services,
    prices,
    gallery,
  ].filter(Boolean).length;

  return {
    basicInfo,
    location,
    educationOffer,
    services,
    prices,
    gallery,
    completionPercent: Math.round((completed / ONBOARDING_STEPS) * 100),
  };
}
