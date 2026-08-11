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

export type ApproveSchoolInput = {
  schoolId: string;
  actorUserId: string;
  actorRole: UserRole;
};

export type ApproveSchoolOutput = {
  schoolId: string;
  status: SchoolStatus;
};

@Injectable()
export class ApproveSchoolUseCase
  implements UseCase<ApproveSchoolInput, ApproveSchoolOutput>
{
  constructor(
    @Inject(SCHOOL_REPOSITORY)
    private readonly schools: SchoolRepository,
  ) {}

  async execute(input: ApproveSchoolInput): Promise<ApproveSchoolOutput> {
    if (input.actorRole !== UserRole.EKANDA_ADMIN) {
      throw new ForbiddenDomainException(
        'Apenas administradores Ekanda podem aprovar colégios',
      );
    }

    const school = await this.schools.findById(input.schoolId);
    if (!school) throw new SchoolNotFoundException();

    school.approveFromReview(input.actorUserId);
    await this.schools.save(school);

    return { schoolId: school.id, status: school.status };
  }
}
