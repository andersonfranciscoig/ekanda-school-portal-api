import { EducationLevelCode } from '../school.enums';

export const SCHOOL_EDUCATION_LEVEL_REPOSITORY = Symbol(
  'SCHOOL_EDUCATION_LEVEL_REPOSITORY',
);

export interface SchoolEducationLevelRepository {
  findBySchoolId(schoolId: string): Promise<EducationLevelCode[]>;
  sync(schoolId: string, levels: EducationLevelCode[]): Promise<EducationLevelCode[]>;
}
