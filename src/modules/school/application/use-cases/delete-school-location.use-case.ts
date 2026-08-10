import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  AUDIT_LOGGER,
  AuditLogger,
} from '../../../../shared/application/ports/audit-logger.port';
import { SchoolLocationNotFoundException } from '../../domain/exceptions/school.exceptions';
import {
  SCHOOL_LOCATION_REPOSITORY,
  SchoolLocationRepository,
} from '../../domain/repositories/school-location.repository';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';

export type DeleteSchoolLocationInput = {
  schoolId: string;
  actorUserId: string;
};

export type DeleteSchoolLocationOutput = {
  schoolId: string;
  deleted: true;
};

@Injectable()
export class DeleteSchoolLocationUseCase
  implements UseCase<DeleteSchoolLocationInput, DeleteSchoolLocationOutput>
{
  constructor(
    @Inject(SCHOOL_LOCATION_REPOSITORY)
    private readonly locations: SchoolLocationRepository,
    private readonly access: SchoolAccessAuthorizer,
    @Inject(AUDIT_LOGGER)
    private readonly audit: AuditLogger,
  ) {}

  async execute(
    input: DeleteSchoolLocationInput,
  ): Promise<DeleteSchoolLocationOutput> {
    await this.access.assertSchoolExists(input.schoolId);
    await this.access.assertCanManageSchool(input.actorUserId, input.schoolId);

    const location = await this.locations.findBySchoolId(input.schoolId);
    if (!location) {
      throw new SchoolLocationNotFoundException();
    }

    const oldData = location.toSnapshot();
    const deleted = await this.locations.deleteBySchoolId(input.schoolId);
    if (!deleted) {
      throw new SchoolLocationNotFoundException();
    }

    await this.audit.log({
      actorUserId: input.actorUserId,
      action: 'SCHOOL_LOCATION_DELETED',
      entity: 'SchoolLocation',
      entityId: location.id,
      oldData,
      newData: null,
      metadata: { schoolId: input.schoolId },
    });

    return { schoolId: input.schoolId, deleted: true };
  }
}
