import { buildSchoolOnboardingProgress } from './school-onboarding.progress';

describe('buildSchoolOnboardingProgress', () => {
  const base = {
    name: 'Colégio Horizonte',
    description: 'Escola de excelência',
    location: { province: 'Luanda', municipality: 'Belas' },
    educationLevels: [{ id: '1' }],
    classes: [],
    services: [],
    price: null,
    gallery: [],
  };

  it('marks first three steps and 50% when basic/location/education done', () => {
    const progress = buildSchoolOnboardingProgress(base);

    expect(progress).toEqual({
      basicInfo: true,
      location: true,
      educationOffer: true,
      services: false,
      prices: false,
      gallery: false,
      completionPercent: 50,
    });
  });

  it('basicInfo false without name', () => {
    const progress = buildSchoolOnboardingProgress({
      ...base,
      name: '   ',
    });
    expect(progress.basicInfo).toBe(false);
    expect(progress.completionPercent).toBe(33);
  });

  it('educationOffer true when only classes exist', () => {
    const progress = buildSchoolOnboardingProgress({
      ...base,
      educationLevels: [],
      classes: [{ id: 'c1' }],
    });
    expect(progress.educationOffer).toBe(true);
  });

  it('returns 100 when all steps complete', () => {
    const progress = buildSchoolOnboardingProgress({
      ...base,
      services: [{ id: 's1' }],
      price: { id: 'p1' },
      gallery: [{ id: 'g1' }],
    });
    expect(progress.completionPercent).toBe(100);
    expect(progress.services).toBe(true);
    expect(progress.prices).toBe(true);
    expect(progress.gallery).toBe(true);
  });
});
