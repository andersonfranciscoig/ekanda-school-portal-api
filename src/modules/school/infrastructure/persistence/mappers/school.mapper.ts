import { Email } from '../../../../../shared/domain/value-objects/email.vo';
import { Phone } from '../../../../../shared/domain/value-objects/phone.vo';
import { Address } from '../../../../../shared/domain/value-objects/address.vo';
import { Coordinates } from '../../../../../shared/domain/value-objects/coordinates.vo';
import { School } from '../../../domain/aggregates/school.aggregate';
import { SchoolClass } from '../../../domain/entities/school-class.entity';
import { SchoolGalleryItem } from '../../../domain/entities/school-gallery-item.entity';
import { SchoolLocation } from '../../../domain/entities/school-location.entity';
import { SchoolPrice } from '../../../domain/entities/school-price.entity';
import { SchoolServiceOffer } from '../../../domain/entities/school-service.entity';
import { SchoolStatus } from '../../../domain/school.enums';
import { SchoolSlug } from '../../../domain/value-objects/school-slug.vo';
import { Money } from '../../../../../shared/domain/value-objects/money.vo';

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
  foundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  location?: {
    id: string;
    province: string;
    municipality: string;
    district: string | null;
    neighborhood: string | null;
    address: string | null;
    latitude: { toNumber(): number } | number | null;
    longitude: { toNumber(): number } | number | null;
  } | null;
  classes?: Array<{
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
  }>;
  services?: Array<{
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
  }>;
  prices?: Array<{
    id: string;
    name: string;
    amount: { toNumber(): number } | number;
    currency: string;
    billingPeriod: string;
    schoolClassId: string | null;
    isActive: boolean;
  }>;
  gallery?: Array<{
    id: string;
    url: string;
    type: string;
    caption: string | null;
    sortOrder: number;
  }>;
};

export class SchoolMapper {
  static toDomain(record: PrismaSchoolRecord): School {
    const location = record.location
      ? SchoolLocation.create({
          id: record.location.id,
          address: Address.create({
            province: record.location.province,
            municipality: record.location.municipality,
            district: record.location.district,
            neighborhood: record.location.neighborhood,
            street: record.location.address,
          }),
          coordinates:
            record.location.latitude != null && record.location.longitude != null
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
      foundedAt: record.foundedAt,
      location,
      classes: (record.classes ?? []).map((c) =>
        SchoolClass.create({
          id: c.id,
          name: c.name,
          description: c.description,
          isActive: c.isActive,
        }),
      ),
      services: (record.services ?? []).map((s) =>
        SchoolServiceOffer.create({
          id: s.id,
          name: s.name,
          description: s.description,
          isActive: s.isActive,
        }),
      ),
      prices: (record.prices ?? []).map((p) =>
        SchoolPrice.create({
          id: p.id,
          name: p.name,
          amount: Money.create(
            typeof p.amount === 'number' ? p.amount : p.amount.toNumber(),
            p.currency,
          ),
          billingPeriod: p.billingPeriod,
          schoolClassId: p.schoolClassId,
          isActive: p.isActive,
        }),
      ),
      gallery: (record.gallery ?? []).map((g) =>
        SchoolGalleryItem.create({
          id: g.id,
          url: g.url,
          type: g.type,
          caption: g.caption,
          sortOrder: g.sortOrder,
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
      foundedAt: school.foundedAt,
    };
  }
}
