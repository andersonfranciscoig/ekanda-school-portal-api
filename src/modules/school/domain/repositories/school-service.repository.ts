import { SchoolServiceCatalogId } from '../school.enums';

export const SCHOOL_SERVICE_REPOSITORY = Symbol('SCHOOL_SERVICE_REPOSITORY');

export interface SchoolServiceRepository {
  findBySchoolId(schoolId: string): Promise<SchoolServiceCatalogId[]>;
  sync(
    schoolId: string,
    serviceIds: SchoolServiceCatalogId[],
  ): Promise<SchoolServiceCatalogId[]>;
}
