import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  AUDIT_LOGGER,
  AuditLogger,
} from '../../../../shared/application/ports/audit-logger.port';
import {
  SchoolClassAccessDeniedException,
  SchoolClassNotFoundException,
} from '../../domain/exceptions/school.exceptions';
import {
  SCHOOL_CLASS_REPOSITORY,
  SchoolClassRepository,
} from '../../domain/repositories/school-class.repository';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';

export type DeleteSchoolClassInput = {
  schoolId: string;
  classId: string;
  actorUserId: string;
};

export type DeleteSchoolClassOutput = {
  schoolId: string;
  classId: string;
  isActive: false;
};

@Injectable()
export class DeleteSchoolClassUseCase
  implements UseCase<DeleteSchoolClassInput, DeleteSchoolClassOutput>
{
  constructor(
    @Inject(SCHOOL_CLASS_REPOSITORY)
    private readonly classes: SchoolClassRepository,
    private readonly access: SchoolAccessAuthorizer,
    @Inject(AUDIT_LOGGER)
    private readonly audit: AuditLogger,
  ) {}

  async execute(
    input: DeleteSchoolClassInput,
  ): Promise<DeleteSchoolClassOutput> {
    await this.access.assertSchoolExists(input.schoolId);
    await this.access.assertCanManageSchool(input.actorUserId, input.schoolId);

    const schoolClass = await this.classes.findById(input.classId);
    if (!schoolClass) {
      throw new SchoolClassNotFoundException();
    }

    if (!schoolClass.belongsToSchool(input.schoolId)) {
      throw new SchoolClassAccessDeniedException();
    }

    if (!schoolClass.isActive) {
      return {
        schoolId: input.schoolId,
        classId: schoolClass.id,
        isActive: false,
      };
    }

    const oldData = schoolClass.toSnapshot();
    schoolClass.deactivate();
    await this.classes.update(schoolClass);

    await this.audit.log({
      actorUserId: input.actorUserId,
      action: 'SCHOOL_CLASS_DELETED',
      entity: 'SchoolClass',
      entityId: schoolClass.id,
      oldData,
      newData: schoolClass.toSnapshot(),
      metadata: { softDelete: true, schoolId: input.schoolId },
    });

    return {
      schoolId: input.schoolId,
      classId: schoolClass.id,
      isActive: false,
    };
  }
}
