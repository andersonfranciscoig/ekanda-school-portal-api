import {
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
