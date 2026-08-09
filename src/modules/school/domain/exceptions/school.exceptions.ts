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

