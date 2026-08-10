import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  AUDIT_LOGGER,
  AuditLogger,
} from '../../../../shared/application/ports/audit-logger.port';
import { SchoolEducationLevelsNotFoundException } from '../../domain/exceptions/school.exceptions';
import {
  SCHOOL_EDUCATION_LEVEL_REPOSITORY,
  SchoolEducationLevelRepository,
} from '../../domain/repositories/school-education-level.repository';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';

export type DeleteSchoolEducationLevelsInput = {
  schoolId: string;
  actorUserId: string;
};

export type DeleteSchoolEducationLevelsOutput = {
  schoolId: string;
  levels: [];
  deleted: true;
};

@Injectable()
export class DeleteSchoolEducationLevelsUseCase
  implements
    UseCase<
      DeleteSchoolEducationLevelsInput,
      DeleteSchoolEducationLevelsOutput
    >
{
  constructor(
    @Inject(SCHOOL_EDUCATION_LEVEL_REPOSITORY)
    private readonly educationLevels: SchoolEducationLevelRepository,
    private readonly access: SchoolAccessAuthorizer,
    @Inject(AUDIT_LOGGER)
    private readonly audit: AuditLogger,
  ) {}

  async execute(
    input: DeleteSchoolEducationLevelsInput,
  ): Promise<DeleteSchoolEducationLevelsOutput> {
    await this.access.assertSchoolExists(input.schoolId);
    await this.access.assertCanManageSchool(input.actorUserId, input.schoolId);

    const current = await this.educationLevels.findBySchoolId(input.schoolId);
    if (current.length === 0) {
      throw new SchoolEducationLevelsNotFoundException();
    }

    await this.educationLevels.sync(input.schoolId, []);

    await this.audit.log({
      actorUserId: input.actorUserId,
      action: 'SCHOOL_EDUCATION_LEVELS_DELETED',
      entity: 'SchoolEducationLevel',
      entityId: input.schoolId,
      oldData: { levels: current },
      newData: { levels: [] },
      metadata: { schoolId: input.schoolId },
    });

    return { schoolId: input.schoolId, levels: [], deleted: true };
  }
}
