import { SchoolPricing } from '../entities/school-pricing.entity';

export const SCHOOL_PRICE_REPOSITORY = Symbol('SCHOOL_PRICE_REPOSITORY');

export interface SchoolPriceRepository {
  findById(id: string): Promise<SchoolPricing | null>;
  findBySchoolId(schoolId: string): Promise<SchoolPricing | null>;
  create(pricing: SchoolPricing): Promise<SchoolPricing>;
  update(pricing: SchoolPricing): Promise<SchoolPricing>;
}
