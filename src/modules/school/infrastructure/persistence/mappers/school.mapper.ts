import { Email } from '../../../../../shared/domain/value-objects/email.vo';
import { Phone } from '../../../../../shared/domain/value-objects/phone.vo';
import { Address } from '../../../../../shared/domain/value-objects/address.vo';
import { Coordinates } from '../../../../../shared/domain/value-objects/coordinates.vo';
import { School } from '../../../domain/aggregates/school.aggregate';
import { SchoolClass } from '../../../domain/entities/school-class.entity';
import { SchoolGalleryItem } from '../../../domain/entities/school-gallery-item.entity';
import { SchoolLocation } from '../../../domain/entities/school-location.entity';
import { SchoolServiceOffer } from '../../../domain/entities/school-service.entity';
import { SchoolStatus } from '../../../domain/school.enums';
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
    enrollmentFee: { toNumber(): number } | number | null;
    tuitionFee: { toNumber(): number } | number | null;
    transportFee: { toNumber(): number } | number | null;
    mealFee: { toNumber(): number } | number | null;
    otherFees: { toNumber(): number } | number | null;
    currency: string;
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
        SchoolClass.create({
          id: c.id,
          name: c.classLabel,
          description: c.schedule,
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
        SchoolGalleryItem.create({
          id: g.id,
          url: g.url,
          type: g.kind === 'VIDEO' ? 'VIDEO' : 'IMAGE',
          caption: g.fileName,
          sortOrder: g.order,
        }),
      ),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
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
    };
  }
}
