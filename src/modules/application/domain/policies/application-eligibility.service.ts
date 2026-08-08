/**
 * ApplicationEligibilityService — regras que cruzam Student/Guardian/School.
 */
export class ApplicationEligibilityService {
  static canSubmit(params: {
    studentExists: boolean;
    guardianOwnsStudent: boolean;
    schoolIsActive: boolean;
    schoolClassAvailable: boolean;
  }): { eligible: boolean; reasons: string[] } {
    const reasons: string[] = [];
    if (!params.studentExists) reasons.push('student_not_found');
    if (!params.guardianOwnsStudent) reasons.push('guardian_not_authorized');
    if (!params.schoolIsActive) reasons.push('school_not_active');
    if (!params.schoolClassAvailable) reasons.push('school_class_unavailable');
    return { eligible: reasons.length === 0, reasons };
  }
}
