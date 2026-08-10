import { SchoolLocation } from '../entities/school-location.entity';

export const SCHOOL_LOCATION_REPOSITORY = Symbol('SCHOOL_LOCATION_REPOSITORY');

export interface SchoolLocationRepository {
  findById(id: string): Promise<SchoolLocation | null>;
  findBySchoolId(schoolId: string): Promise<SchoolLocation | null>;
  create(location: SchoolLocation): Promise<SchoolLocation>;
  update(location: SchoolLocation): Promise<SchoolLocation>;
  deleteBySchoolId(schoolId: string): Promise<boolean>;
}
