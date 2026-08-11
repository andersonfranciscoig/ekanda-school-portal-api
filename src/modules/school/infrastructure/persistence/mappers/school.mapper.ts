import { Email } from '../../../../../shared/domain/value-objects/email.vo';
import { Phone } from '../../../../../shared/domain/value-objects/phone.vo';
import { Address } from '../../../../../shared/domain/value-objects/address.vo';
import { Coordinates } from '../../../../../shared/domain/value-objects/coordinates.vo';
import { School } from '../../../domain/aggregates/school.aggregate';
import { SchoolClass } from '../../../domain/entities/school-class.entity';
import { SchoolGalleryItem } from '../../../domain/entities/school-gallery-item.entity';
import { SchoolLocation } from '../../../domain/entities/school-location.entity';
import { SchoolServiceOffer } from '../../../domain/entities/school-service.entity';
import { SchoolClassShift, GalleryKind, SchoolStatus } from '../../../domain/school.enums';
import { SchoolSlug } from '../../../domain/value-objects/school-slug.vo';

type PrismaSchoolRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  foundedYear: number | null;
  approximateStudents?: number | null;
  instagram?: string | null;
  facebook?: string | null;
  createdAt: Date;
  updatedAt: Date;
  rejectionReason?: string | null;
  reviewedAt?: Date | null;
  reviewedByUserId?: string | null;
  submittedForReviewAt?: Date | null;
  location?: {
    id: string;
    province: string;
    municipality: string;
    neighborhood: string | null;
    address: string | null;
    latitude: { toNumber(): number } | number | null;
    longitude: { toNumber(): number } | number | null;
  } | null;
  classes?: Array<{
    id: string;
    classLabel: string;
    vacancies: number;
    shift: string;
    schedule: string | null;
    isActive: boolean;
  }>;
  services?: Array<{
    id: string;
    serviceId: string;
  }>;
  price?: {
    id: string;
    otherFees: { toNumber(): number } | number | null;
    currency: string;
    levels?: Array<{
      id: string;
      levelId: string;
      enrollmentFeeMin: { toNumber(): number } | number | null;
      enrollmentFeeMax: { toNumber(): number } | number | null;
      tuitionFeeMin: { toNumber(): number } | number | null;
      tuitionFeeMax: { toNumber(): number } | number | null;
      transportFeeMin: { toNumber(): number } | number | null;
      transportFeeMax: { toNumber(): number } | number | null;
      mealFeeMin: { toNumber(): number } | number | null;
      mealFeeMax: { toNumber(): number } | number | null;
    }>;
  } | null;
  gallery?: Array<{
    id: string;
    url: string;
    kind: string;
    order: number;
    fileName: string | null;
  }>;
};

export class SchoolMapper {
  static toDomain(record: PrismaSchoolRecord): School {
    const location = record.location
      ? SchoolLocation.rehydrate({
          id: record.location.id,
          schoolId: record.id,
          address: Address.create({
            province: record.location.province,
            municipality: record.location.municipality,
            district: null,
            neighborhood: record.location.neighborhood,
            street: record.location.address,
          }),
          coordinates:
            record.location.latitude != null &&
            record.location.longitude != null
              ? Coordinates.create(
                  typeof record.location.latitude === 'number'
                    ? record.location.latitude
                    : record.location.latitude.toNumber(),
                  typeof record.location.longitude === 'number'
                    ? record.location.longitude
                    : record.location.longitude.toNumber(),
                )
              : null,
        })
      : null;

    return School.rehydrate({
      id: record.id,
      name: record.name,
      slug: SchoolSlug.create(record.slug),
      description: record.description,
      status: record.status as SchoolStatus,
      phone: record.phone ? Phone.create(record.phone) : null,
      email: record.email ? Email.create(record.email) : null,
      website: record.website,
      logoUrl: record.logoUrl,
      coverImageUrl: record.coverImageUrl,
      foundedYear: record.foundedYear ?? null,
      approximateStudents: record.approximateStudents ?? null,
      instagram: record.instagram ?? null,
      facebook: record.facebook ?? null,
      location,
      classes: (record.classes ?? []).map((c) =>
        SchoolClass.rehydrate({
          id: c.id,
          schoolId: record.id,
          classLabel: c.classLabel,
          vacancies: c.vacancies,
          shift: c.shift as SchoolClassShift,
          schedule: c.schedule,
          isActive: c.isActive,
        }),
      ),
      services: (record.services ?? []).map((s) =>
        SchoolServiceOffer.create({
          id: s.id,
          name: s.serviceId,
          description: null,
          isActive: true,
        }),
      ),
      // SchoolPrice 1:1 (fees) — domínio de lista antiga ainda não alinhado.
      prices: [],
      gallery: (record.gallery ?? []).map((g) =>
        SchoolGalleryItem.rehydrate({
          id: g.id,
          schoolId: record.id,
          url: g.url,
          kind: g.kind === 'VIDEO' ? GalleryKind.VIDEO : GalleryKind.PHOTO,
          order: g.order,
          fileName: g.fileName,
        }),
      ),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      rejectionReason: record.rejectionReason ?? null,
      reviewedAt: record.reviewedAt ?? null,
      reviewedByUserId: record.reviewedByUserId ?? null,
      submittedForReviewAt: record.submittedForReviewAt ?? null,
    });
  }

  static toPersistence(school: School) {
    return {
      id: school.id,
      name: school.name,
      slug: school.slug.value,
      description: school.description,
      status: school.status,
      phone: school.phone?.value ?? null,
      email: school.email?.value ?? null,
      website: school.website,
      logoUrl: school.logoUrl,
      coverImageUrl: school.coverImageUrl,
      foundedYear: school.foundedYear,
      approximateStudents: school.approximateStudents,
      instagram: school.instagram,
      facebook: school.facebook,
      rejectionReason: school.rejectionReason,
      reviewedAt: school.reviewedAt,
      reviewedByUserId: school.reviewedByUserId,
      submittedForReviewAt: school.submittedForReviewAt,
    };
  }
}
