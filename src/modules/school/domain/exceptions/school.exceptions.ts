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
