import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { SchoolServiceCatalogId } from '../../domain/school.enums';
import {
  SCHOOL_SERVICE_REPOSITORY,
  SchoolServiceRepository,
} from '../../domain/repositories/school-service.repository';
import { parseSchoolServiceCatalogList } from '../../domain/value-objects/school-catalog.parsers';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';

export type SyncSchoolServicesInput = {
  schoolId: string;
  serviceIds: string[];
  actorUserId: string;
};

export type SyncSchoolServicesOutput = {
  schoolId: string;
  serviceIds: SchoolServiceCatalogId[];
};

@Injectable()
export class SyncSchoolServicesUseCase
  implements UseCase<SyncSchoolServicesInput, SyncSchoolServicesOutput>
{
  constructor(
    @Inject(SCHOOL_SERVICE_REPOSITORY)
    private readonly services: SchoolServiceRepository,
    private readonly access: SchoolAccessAuthorizer,
  ) {}

  async execute(
    input: SyncSchoolServicesInput,
  ): Promise<SyncSchoolServicesOutput> {
    await this.access.assertSchoolExists(input.schoolId);
    await this.access.assertCanManageSchool(input.actorUserId, input.schoolId);

    const serviceIds = parseSchoolServiceCatalogList(input.serviceIds);
    const synced = await this.services.sync(input.schoolId, serviceIds);

    return {
      schoolId: input.schoolId,
      serviceIds: synced,
    };
  }
}
