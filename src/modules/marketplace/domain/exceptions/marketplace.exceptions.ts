import {
  BusinessRuleViolationException,
  ConflictDomainException,
  EntityNotFoundException,
} from '../../../../shared/domain/exceptions/domain.exception';

export class FavoriteSchoolNotFoundException extends EntityNotFoundException {
  constructor(message = 'School not found') {
    super(message);
    this.name = 'FavoriteSchoolNotFoundException';
  }
}

export class FavoriteNotFoundException extends EntityNotFoundException {
  constructor(message = 'Favorite not found') {
    super(message);
    this.name = 'FavoriteNotFoundException';
  }
}

export class SchoolNotEligibleForFavoriteException extends ConflictDomainException {
  constructor(
    message = 'Only ACTIVE schools with a public profile can be favorited',
  ) {
    super(message);
    this.name = 'SchoolNotEligibleForFavoriteException';
  }
}

export class ReviewSchoolNotFoundException extends EntityNotFoundException {
  constructor(message = 'School not found') {
    super(message);
    this.name = 'ReviewSchoolNotFoundException';
  }
}

export class ReviewSchoolNotEligibleException extends ConflictDomainException {
  constructor(
    message = 'Only ACTIVE schools with a public profile can be reviewed',
  ) {
    super(message);
    this.name = 'ReviewSchoolNotEligibleException';
  }
}

export class ReviewNotFoundException extends EntityNotFoundException {
  constructor(message = 'Review not found') {
    super(message);
    this.name = 'ReviewNotFoundException';
  }
}

export class InvalidReviewRatingException extends BusinessRuleViolationException {
  constructor(message = 'Rating must be an integer between 1 and 5') {
    super(message);
    this.name = 'InvalidReviewRatingException';
  }
}

export class ReviewIdentityRequiredException extends BusinessRuleViolationException {
  constructor(
    message = 'A review requires a logged-in user or an x-device-id header',
  ) {
    super(message);
    this.name = 'ReviewIdentityRequiredException';
  }
}
