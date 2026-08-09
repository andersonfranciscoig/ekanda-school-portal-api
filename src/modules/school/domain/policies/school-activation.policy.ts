import { SchoolActivationSnapshot } from '../aggregates/school.aggregate';
import { School } from '../aggregates/school.aggregate';


export class SchoolActivationPolicy {
  static evaluate(
    school: School,
    hasValidSubscription: boolean,
  ): SchoolActivationSnapshot {
    return {
      hasMinimumProfile: school.hasMinimumProfile(),
      hasLocation: school.location !== null,
      hasActiveClass: school.classes.some((c) => c.isActive),
      hasValidSubscription,
    };
  }

  static canActivate(
    school: School,
    hasValidSubscription: boolean,
  ): { eligible: boolean; reasons: string[] } {
    const snapshot = this.evaluate(school, hasValidSubscription);
    const reasons: string[] = [];
    if (!snapshot.hasMinimumProfile) reasons.push('missing_minimum_profile');
    if (!snapshot.hasLocation) reasons.push('missing_location');
    if (!snapshot.hasActiveClass) reasons.push('missing_active_class');
    if (!snapshot.hasValidSubscription) reasons.push('missing_valid_subscription');
    return { eligible: reasons.length === 0, reasons };
  }
}
