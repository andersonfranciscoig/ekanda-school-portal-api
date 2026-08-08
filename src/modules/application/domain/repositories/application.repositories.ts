import { Student } from '../entities/student.entity';
import { Application } from '../aggregates/application.aggregate';

export const STUDENT_REPOSITORY = Symbol('STUDENT_REPOSITORY');
export const APPLICATION_REPOSITORY = Symbol('APPLICATION_REPOSITORY');

export interface StudentRepository {
  save(student: Student): Promise<void>;
  findById(id: string): Promise<Student | null>;
  listByGuardianId(guardianId: string): Promise<Student[]>;
}

export interface ApplicationRepository {
  save(application: Application): Promise<void>;
  findById(id: string): Promise<Application | null>;
  listBySchoolId(schoolId: string): Promise<Application[]>;
  listByGuardianId(guardianId: string): Promise<Application[]>;
}
