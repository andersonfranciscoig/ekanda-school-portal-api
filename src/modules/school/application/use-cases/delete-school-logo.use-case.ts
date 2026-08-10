import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  AUDIT_LOGGER,
  AuditLogger,
} from '../../../../shared/application/ports/audit-logger.port';
import {
  FILE_STORAGE,
  FileStorage,
} from '../../../../shared/application/ports/file-storage.port';
import { SchoolNotFoundException } from '../../domain/exceptions/school.exceptions';
import {
  SCHOOL_REPOSITORY,
  SchoolRepository,
} from '../../domain/repositories/school.repository';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';

export type DeleteSchoolLogoInput = {
  schoolId: string;
  actorUserId: string;
};

export type DeleteSchoolLogoOutput = {
  schoolId: string;
  logoUrl: null;
};

@Injectable()
export class DeleteSchoolLogoUseCase
  implements UseCase<DeleteSchoolLogoInput, DeleteSchoolLogoOutput>
{
  constructor(
    @Inject(SCHOOL_REPOSITORY)
    private readonly schools: SchoolRepository,
    private readonly access: SchoolAccessAuthorizer,
    @Inject(FILE_STORAGE)
    private readonly files: FileStorage,
    @Inject(AUDIT_LOGGER)
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: DeleteSchoolLogoInput): Promise<DeleteSchoolLogoOutput> {
    await this.access.assertSchoolExists(input.schoolId);
    await this.access.assertCanManageSchool(input.actorUserId, input.schoolId);

    const school = await this.schools.findById(input.schoolId);
    if (!school) {
      throw new SchoolNotFoundException();
    }

    const previousLogo = school.logoUrl;
    if (!previousLogo) {
      return { schoolId: school.id, logoUrl: null };
    }

    const oldData = school.toSnapshot();
    school.updateProfile({ logoUrl: null }, input.actorUserId);
    await this.schools.save(school);

    await this.files.delete(previousLogo);

    await this.audit.log({
      actorUserId: input.actorUserId,
      action: 'SCHOOL_LOGO_DELETED',
      entity: 'School',
      entityId: school.id,
      oldData: { logoUrl: previousLogo },
      newData: { logoUrl: null },
      metadata: { previousSnapshot: oldData },
    });

    return { schoolId: school.id, logoUrl: null };
  }
}
