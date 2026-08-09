import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { EducationLevelCode } from '../../domain/school.enums';
import {
  SCHOOL_EDUCATION_LEVEL_REPOSITORY,
  SchoolEducationLevelRepository,
} from '../../domain/repositories/school-education-level.repository';
import { parseEducationLevelList } from '../../domain/value-objects/school-catalog.parsers';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';

export type SyncSchoolEducationLevelsInput = {
  schoolId: string;
  levels: string[];
  actorUserId: string;
};

export type SyncSchoolEducationLevelsOutput = {
  schoolId: string;
  levels: EducationLevelCode[];
};

@Injectable()
export class SyncSchoolEducationLevelsUseCase
  implements
    UseCase<SyncSchoolEducationLevelsInput, SyncSchoolEducationLevelsOutput>
{
  constructor(
    @Inject(SCHOOL_EDUCATION_LEVEL_REPOSITORY)
    private readonly educationLevels: SchoolEducationLevelRepository,
    private readonly access: SchoolAccessAuthorizer,
  ) {}

  async execute(
    input: SyncSchoolEducationLevelsInput,
  ): Promise<SyncSchoolEducationLevelsOutput> {
    await this.access.assertSchoolExists(input.schoolId);
    await this.access.assertCanManageSchool(input.actorUserId, input.schoolId);

    const levels = parseEducationLevelList(input.levels);
    const synced = await this.educationLevels.sync(input.schoolId, levels);

    return {
      schoolId: input.schoolId,
      levels: synced,
    };
  }
}
