export class DomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvariantViolationException extends DomainException {}
export class EntityNotFoundException extends DomainException {}
export class ConflictDomainException extends DomainException {}
export class UnauthorizedDomainException extends DomainException {}
export class ForbiddenDomainException extends DomainException {}
export class BusinessRuleViolationException extends DomainException {}
