import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { AUDIT_LOGGER } from '../../../../shared/application/ports/audit-logger.port';
import type { AuditLogger } from '../../../../shared/application/ports/audit-logger.port';
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
    @Inject(AUDIT_LOGGER)
    private readonly audit: AuditLogger,
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

    await this.audit.log({
      actorUserId: input.actorUserId,
      action: 'SCHOOL_APPROVED',
      entity: 'SCHOOL',
      entityId: school.id,
      oldData: { status: 'PENDING_REVIEW' },
      newData: { status: school.status },
      metadata: {
        from: 'PENDING_REVIEW',
        to: school.status,
        entityLabel: school.name,
      },
    });

    return { schoolId: school.id, status: school.status };
  }
}
