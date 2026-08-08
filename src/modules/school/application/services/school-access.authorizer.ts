import { Inject, Injectable } from '@nestjs/common';
import {
  ForbiddenDomainException,
} from '../../../../shared/domain/exceptions/domain.exception';
import { UserRole } from '../../../identity/domain/entities/user.entity';
import {
  SchoolAccessDeniedException,
  SchoolNotFoundException,
} from '../../domain/exceptions/school.exceptions';
import { SchoolMembershipRole } from '../../domain/school.enums';
import {
  SCHOOL_REPOSITORY,
  SchoolMembershipView,
  SchoolRepository,
} from '../../domain/repositories/school.repository';

/**
 * Autorização multi-tenant (Application) — separada das regras de domínio.
 */
@Injectable()
export class SchoolAccessAuthorizer {
  constructor(
    @Inject(SCHOOL_REPOSITORY)
    private readonly schools: SchoolRepository,
  ) {}

  assertCanCreateSchool(actorRole: UserRole): void {
    const allowed: UserRole[] = [
      UserRole.SCHOOL_OWNER,
      UserRole.SCHOOL_ADMIN,
      UserRole.EKANDA_ADMIN,
    ];
    if (!allowed.includes(actorRole)) {
      throw new ForbiddenDomainException(
        'Only SCHOOL_OWNER or SCHOOL_ADMIN can create a school',
      );
    }
  }

  async assertCanManageSchool(
    userId: string,
    schoolId: string,
    roles: SchoolMembershipRole[] = [
      SchoolMembershipRole.OWNER,
      SchoolMembershipRole.ADMIN,
    ],
  ): Promise<SchoolMembershipView> {
    const membership = await this.schools.findActiveMembership(
      schoolId,
      userId,
    );

    if (!membership) {
      throw new SchoolAccessDeniedException();
    }

    if (!roles.includes(membership.role)) {
      throw new SchoolAccessDeniedException(
        'Insufficient permission for this school',
      );
    }

    return membership;
  }

  async assertSchoolExists(schoolId: string) {
    const school = await this.schools.findById(schoolId);
    if (!school) {
      throw new SchoolNotFoundException();
    }
    return school;
  }
}
