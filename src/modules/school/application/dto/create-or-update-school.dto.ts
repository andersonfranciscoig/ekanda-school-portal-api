/**
 * Application-level input shape for CreateOrUpdateSchool.
 * HTTP mapping stays in infrastructure DTO.
 */
export type CreateOrUpdateSchoolAppDto = {
  id?: string;
  name: string;
  description?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  foundedYear?: number;
  foundedAt?: Date;
  approximateStudents?: number;
  instagram?: string;
  facebook?: string;
  province?: string;
  municipality?: string;
  neighborhood?: string;
  address?: string;
};
