import { School } from '../aggregates/school.aggregate';
import { SchoolMembershipRole } from '../school.enums';

export const SCHOOL_REPOSITORY = Symbol('SCHOOL_REPOSITORY');

export interface SchoolMembershipView {
  userId: string;
  schoolId: string;
  role: SchoolMembershipRole;
  status: string;
}

/**
 * Porta de persistência do Aggregate School.
 * Métodos orientados às necessidades do domínio / use cases.
 */
export interface SchoolRepository {
  save(school: School): Promise<void>;
  findById(id: string): Promise<School | null>;
  findBySlug(slug: string): Promise<School | null>;
  existsBySlug(slug: string): Promise<boolean>;
  findActiveMembership(
    schoolId: string,
    userId: string,
  ): Promise<SchoolMembershipView | null>;
  listByMemberUserId(userId: string): Promise<School[]>;
  createWithOwner(params: {
    school: School;
    ownerUserId: string;
  }): Promise<School>;
}
