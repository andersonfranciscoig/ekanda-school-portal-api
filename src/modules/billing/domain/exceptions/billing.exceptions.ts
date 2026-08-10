import {
  BusinessRuleViolationException,
  EntityNotFoundException,
} from '../../../../shared/domain/exceptions/domain.exception';

export class PlanNotFoundException extends EntityNotFoundException {
  constructor(message = 'Plan not found') {
    super(message);
    this.name = 'PlanNotFoundException';
  }
}

export class SubscriptionNotFoundException extends EntityNotFoundException {
  constructor(message = 'Subscription not found') {
    super(message);
    this.name = 'SubscriptionNotFoundException';
  }
}

export class FreePlanUnavailableException extends BusinessRuleViolationException {
  constructor(message = 'Free plan is not available') {
    super(message);
    this.name = 'FreePlanUnavailableException';
  }
}

export class SchoolCannotActivateFreePlanException extends BusinessRuleViolationException {
  constructor(
    message = 'School cannot activate the free plan in the current status',
  ) {
    super(message);
    this.name = 'SchoolCannotActivateFreePlanException';
  }
}
