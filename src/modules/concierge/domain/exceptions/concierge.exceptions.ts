import {
  ConflictDomainException,
  EntityNotFoundException,
  ForbiddenDomainException,
  BusinessRuleViolationException,
} from '../../../../shared/domain/exceptions/domain.exception';

export class ConciergeSessionNotFoundException extends EntityNotFoundException {
  constructor(message = 'Concierge session not found') {
    super(message);
    this.name = 'ConciergeSessionNotFoundException';
  }
}

export class ConciergeVisitNotFoundException extends EntityNotFoundException {
  constructor(message = 'Concierge visit not found') {
    super(message);
    this.name = 'ConciergeVisitNotFoundException';
  }
}

export class ConciergeAccessDeniedException extends ForbiddenDomainException {
  constructor(message = 'Access denied to this concierge session') {
    super(message);
    this.name = 'ConciergeAccessDeniedException';
  }
}

export class InvalidVisitTimeException extends BusinessRuleViolationException {
  constructor(message = 'Invalid visit time') {
    super(message);
    this.name = 'InvalidVisitTimeException';
  }
}

export class ConciergeSchoolNotFoundException extends EntityNotFoundException {
  constructor(message = 'School not found') {
    super(message);
    this.name = 'ConciergeSchoolNotFoundException';
  }
}

export class ConciergeConflictException extends ConflictDomainException {
  constructor(message: string) {
    super(message);
    this.name = 'ConciergeConflictException';
  }
}
