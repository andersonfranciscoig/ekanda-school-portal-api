import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ForbiddenDomainException } from '../../../../shared/domain/exceptions/domain.exception';
import { UserRole } from '../../../identity/domain/entities/user.entity';
import { SchoolNotFoundException } from '../../../school/domain/exceptions/school.exceptions';
import {
  SCHOOL_REPOSITORY,
  SchoolRepository,
} from '../../../school/domain/repositories/school.repository';
import { SchoolStatus } from '../../../school/domain/school.enums';

export type RejectSchoolInput = {
  schoolId: string;
  actorUserId: string;
  actorRole: UserRole;
  reason: string;
};

export type RejectSchoolOutput = {
  schoolId: string;
  status: SchoolStatus;
  rejectionReason: string | null;
};

@Injectable()
export class RejectSchoolUseCase
  implements UseCase<RejectSchoolInput, RejectSchoolOutput>
{
  constructor(
    @Inject(SCHOOL_REPOSITORY)
    private readonly schools: SchoolRepository,
  ) {}

  async execute(input: RejectSchoolInput): Promise<RejectSchoolOutput> {
    if (input.actorRole !== UserRole.EKANDA_ADMIN) {
      throw new ForbiddenDomainException(
        'Apenas administradores Ekanda podem rejeitar colégios',
      );
    }

    const school = await this.schools.findById(input.schoolId);
    if (!school) throw new SchoolNotFoundException();

    school.rejectFromReview(input.actorUserId, input.reason);
    await this.schools.save(school);

    return {
      schoolId: school.id,
      status: school.status,
      rejectionReason: school.rejectionReason,
    };
  }
}
