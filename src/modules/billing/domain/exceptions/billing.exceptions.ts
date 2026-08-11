import {
  BusinessRuleViolationException,
  EntityNotFoundException,
  ForbiddenDomainException,
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

export class PaymentNotFoundException extends EntityNotFoundException {
  constructor(message = 'Payment not found') {
    super(message);
    this.name = 'PaymentNotFoundException';
  }
}

export class WalletNotFoundException extends EntityNotFoundException {
  constructor(message = 'Wallet not found') {
    super(message);
    this.name = 'WalletNotFoundException';
  }
}

export class InsufficientWalletBalanceException extends BusinessRuleViolationException {
  constructor(message = 'Insufficient wallet balance') {
    super(message);
    this.name = 'InsufficientWalletBalanceException';
  }
}

export class InvalidExpressPhoneException extends BusinessRuleViolationException {
  constructor(message = 'Invalid Multicaixa Express phone number') {
    super(message);
    this.name = 'InvalidExpressPhoneException';
  }
}

export class SchoolSubscriptionExpiredException extends ForbiddenDomainException {
  readonly code = 'SCHOOL_SUBSCRIPTION_EXPIRED';

  constructor(
    message = 'School subscription is expired or not eligible to receive applications',
  ) {
    super(message);
    this.name = 'SchoolSubscriptionExpiredException';
  }
}

export class SchoolFeatureNotAllowedException extends ForbiddenDomainException {
  readonly code = 'SCHOOL_FEATURE_NOT_ALLOWED';

  constructor(message = 'School plan does not include this feature') {
    super(message);
    this.name = 'SchoolFeatureNotAllowedException';
  }
}

export class PaidPlanRequiresPaymentException extends BusinessRuleViolationException {
  constructor(message = 'Paid plan requires a confirmed payment') {
    super(message);
    this.name = 'PaidPlanRequiresPaymentException';
  }
}
