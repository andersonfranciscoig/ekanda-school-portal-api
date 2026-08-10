import {
  BusinessRuleViolationException,
  ConflictDomainException,
  EntityNotFoundException,
  ForbiddenDomainException,
} from '../../../../shared/domain/exceptions/domain.exception';

export class InvalidSchoolDataException extends BusinessRuleViolationException {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSchoolDataException';
  }
}

export class SchoolNotFoundException extends EntityNotFoundException {
  constructor(message = 'School not found') {
    super(message);
    this.name = 'SchoolNotFoundException';
  }
}

export class SchoolAccessDeniedException extends ForbiddenDomainException {
  constructor(
    message = 'Access denied to this school',
  ) {
    super(message);
    this.name = 'SchoolAccessDeniedException';
  }
}

export class SchoolNameAlreadyExistsException extends ConflictDomainException {
  constructor(message = 'A school with this name already exists') {
    super(message);
    this.name = 'SchoolNameAlreadyExistsException';
  }
}

export class FileUploadFailedException extends BusinessRuleViolationException {
  constructor(message = 'File upload failed') {
    super(message);
    this.name = 'FileUploadFailedException';
  }
}

export class InvalidSchoolLocationException extends BusinessRuleViolationException {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSchoolLocationException';
  }
}

export class SchoolLocationNotFoundException extends EntityNotFoundException {
  constructor(message = 'School location not found') {
    super(message);
    this.name = 'SchoolLocationNotFoundException';
  }
}

export class SchoolLocationAlreadyExistsException extends ConflictDomainException {
  constructor(
    message = 'School already has a location. Send id to update.',
  ) {
    super(message);
    this.name = 'SchoolLocationAlreadyExistsException';
  }
}

export class SchoolLocationAccessDeniedException extends ForbiddenDomainException {
  constructor(
    message = 'Location does not belong to the specified school',
  ) {
    super(message);
    this.name = 'SchoolLocationAccessDeniedException';
  }
}

export class InvalidEducationLevelException extends BusinessRuleViolationException {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEducationLevelException';
  }
}

export class DuplicateEducationLevelException extends BusinessRuleViolationException {
  constructor(message = 'Duplicate education levels are not allowed') {
    super(message);
    this.name = 'DuplicateEducationLevelException';
  }
}

export class SchoolEducationLevelsNotFoundException extends EntityNotFoundException {
  constructor(message = 'School education levels not found') {
    super(message);
    this.name = 'SchoolEducationLevelsNotFoundException';
  }
}

export class InvalidSchoolServiceException extends BusinessRuleViolationException {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSchoolServiceException';
  }
}

export class DuplicateSchoolServiceException extends BusinessRuleViolationException {
  constructor(message = 'Duplicate school services are not allowed') {
    super(message);
    this.name = 'DuplicateSchoolServiceException';
  }
}

export class SchoolServicesNotFoundException extends EntityNotFoundException {
  constructor(message = 'School services not found') {
    super(message);
    this.name = 'SchoolServicesNotFoundException';
  }
}

export class EducationLevelNotOfferedBySchoolException extends BusinessRuleViolationException {
  constructor(levelId: string, schoolId: string) {
    super(
      `Education level "${levelId}" is not offered by school "${schoolId}"`,
    );
    this.name = 'EducationLevelNotOfferedBySchoolException';
  }
}

export class InvalidPriceRangeException extends BusinessRuleViolationException {
  constructor(message = 'Invalid price range') {
    super(message);
    this.name = 'InvalidPriceRangeException';
  }
}

export class InvalidCurrencyException extends BusinessRuleViolationException {
  constructor(message = 'currency must be AOA') {
    super(message);
    this.name = 'InvalidCurrencyException';
  }
}

export class SchoolPriceAlreadyExistsException extends ConflictDomainException {
  constructor(
    message = 'School already has prices. Send id to update.',
  ) {
    super(message);
    this.name = 'SchoolPriceAlreadyExistsException';
  }
}

export class SchoolPriceNotFoundException extends EntityNotFoundException {
  constructor(message = 'School price not found') {
    super(message);
    this.name = 'SchoolPriceNotFoundException';
  }
}

export class SchoolPriceAccessDeniedException extends ForbiddenDomainException {
  constructor(
    message = 'School price does not belong to the specified school',
  ) {
    super(message);
    this.name = 'SchoolPriceAccessDeniedException';
  }
}

export class InvalidSchoolGalleryException extends BusinessRuleViolationException {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSchoolGalleryException';
  }
}

export class SchoolGalleryAlreadyExistsException extends ConflictDomainException {
  constructor(
    message = 'School already has gallery items. Send id to update.',
  ) {
    super(message);
    this.name = 'SchoolGalleryAlreadyExistsException';
  }
}

export class SchoolGalleryNotFoundException extends EntityNotFoundException {
  constructor(message = 'School gallery item not found') {
    super(message);
    this.name = 'SchoolGalleryNotFoundException';
  }
}

export class SchoolGalleryAccessDeniedException extends ForbiddenDomainException {
  constructor(
    message = 'Gallery item does not belong to the specified school',
  ) {
    super(message);
    this.name = 'SchoolGalleryAccessDeniedException';
  }
}

export class InvalidSchoolClassException extends BusinessRuleViolationException {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSchoolClassException';
  }
}

export class SchoolClassNotFoundException extends EntityNotFoundException {
  constructor(message = 'School class not found') {
    super(message);
    this.name = 'SchoolClassNotFoundException';
  }
}

export class SchoolClassAccessDeniedException extends ForbiddenDomainException {
  constructor(
    message = 'School class does not belong to this school',
  ) {
    super(message);
    this.name = 'SchoolClassAccessDeniedException';
  }
}

export class SchoolOnboardingIncompleteException extends BusinessRuleViolationException {
  constructor(
    public readonly incompleteSteps: string[],
    public readonly review?: {
      schoolId: string;
      steps: Record<string, { completed: boolean; missingFields: string[] }>;
      completedSteps: number;
      totalSteps: number;
      completionPercent: number;
      canSubmit: boolean;
      status: string;
    },
    message?: string,
  ) {
    super(
      message ??
        `School onboarding incomplete. Pending steps: ${incompleteSteps.join(', ')}`,
    );
    this.name = 'SchoolOnboardingIncompleteException';
  }
}

