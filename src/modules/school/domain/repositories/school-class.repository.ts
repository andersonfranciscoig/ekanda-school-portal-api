import { SchoolClass } from '../entities/school-class.entity';

export const SCHOOL_CLASS_REPOSITORY = Symbol('SCHOOL_CLASS_REPOSITORY');

export interface SchoolClassRepository {
  findById(id: string): Promise<SchoolClass | null>;
  create(schoolClass: SchoolClass): Promise<SchoolClass>;
  update(schoolClass: SchoolClass): Promise<SchoolClass>;
}
