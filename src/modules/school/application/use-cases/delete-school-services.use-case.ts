import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  AUDIT_LOGGER,
  AuditLogger,
} from '../../../../shared/application/ports/audit-logger.port';
import { SchoolServicesNotFoundException } from '../../domain/exceptions/school.exceptions';
import {
  SCHOOL_SERVICE_REPOSITORY,
  SchoolServiceRepository,
} from '../../domain/repositories/school-service.repository';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';

export type DeleteSchoolServicesInput = {
  schoolId: string;
  actorUserId: string;
};

export type DeleteSchoolServicesOutput = {
  schoolId: string;
  serviceIds: [];
  deleted: true;
};

@Injectable()
export class DeleteSchoolServicesUseCase
  implements UseCase<DeleteSchoolServicesInput, DeleteSchoolServicesOutput>
{
  constructor(
    @Inject(SCHOOL_SERVICE_REPOSITORY)
    private readonly services: SchoolServiceRepository,
    private readonly access: SchoolAccessAuthorizer,
    @Inject(AUDIT_LOGGER)
    private readonly audit: AuditLogger,
  ) {}

  async execute(
    input: DeleteSchoolServicesInput,
  ): Promise<DeleteSchoolServicesOutput> {
    await this.access.assertSchoolExists(input.schoolId);
    await this.access.assertCanManageSchool(input.actorUserId, input.schoolId);

    const current = await this.services.findBySchoolId(input.schoolId);
    if (current.length === 0) {
      throw new SchoolServicesNotFoundException();
    }

    await this.services.sync(input.schoolId, []);

    await this.audit.log({
      actorUserId: input.actorUserId,
      action: 'SCHOOL_SERVICES_DELETED',
      entity: 'SchoolService',
      entityId: input.schoolId,
      oldData: { serviceIds: current },
      newData: { serviceIds: [] },
      metadata: { schoolId: input.schoolId },
    });

    return { schoolId: input.schoolId, serviceIds: [], deleted: true };
  }
}
