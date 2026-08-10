import { SchoolOnboardingSnapshot } from '../services/school-onboarding.evaluator';

export const SCHOOL_ONBOARDING_QUERY = Symbol('SCHOOL_ONBOARDING_QUERY');

export interface SchoolOnboardingQuery {
  findSnapshot(schoolId: string): Promise<SchoolOnboardingSnapshot | null>;
}
