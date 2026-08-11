import { Injectable } from '@nestjs/common';
import {
  EducationLevelCode as PrismaEducationLevelCode,
  GalleryKind,
  Prisma,
  SchoolServiceCatalogId as PrismaSchoolServiceCatalogId,
  SchoolStatus,
  Shift,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../../../../shared/infrastructure/persistence/prisma/prisma.service';
import {
  EducationLevelCode,
  SchoolClassShift,
  SchoolServiceCatalogId,
} from '../../../../school/domain/school.enums';
import {
  MarketplaceSchoolRow,
  MarketplaceSearchFilters,
} from '../../../domain/marketplace-search.types';

const PRISMA_LEVEL_TO_DOMAIN: Record<
  PrismaEducationLevelCode,
  EducationLevelCode
> = {
  [PrismaEducationLevelCode.CRECHE]: EducationLevelCode.CRECHE,
  [PrismaEducationLevelCode.PRE_ESCOLAR]: EducationLevelCode.PRE_ESCOLAR,
  [PrismaEducationLevelCode.PRIMARIO]: EducationLevelCode.PRIMARIO,
  [PrismaEducationLevelCode.I_CICLO]: EducationLevelCode.I_CICLO,
  [PrismaEducationLevelCode.II_CICLO]: EducationLevelCode.II_CICLO,
  [PrismaEducationLevelCode.MEDIO]: EducationLevelCode.MEDIO,
};

const PRISMA_SERVICE_TO_DOMAIN: Record<
  PrismaSchoolServiceCatalogId,
  SchoolServiceCatalogId
> = {
  [PrismaSchoolServiceCatalogId.TRANSPORTE]: SchoolServiceCatalogId.TRANSPORTE,
  [PrismaSchoolServiceCatalogId.CANTINA]: SchoolServiceCatalogId.CANTINA,
  [PrismaSchoolServiceCatalogId.BIBLIOTECA]: SchoolServiceCatalogId.BIBLIOTECA,
  [PrismaSchoolServiceCatalogId.LABORATORIO]:
    SchoolServiceCatalogId.LABORATORIO,
  [PrismaSchoolServiceCatalogId.CAMPO]: SchoolServiceCatalogId.CAMPO,
  [PrismaSchoolServiceCatalogId.INFORMATICA]:
    SchoolServiceCatalogId.INFORMATICA,
  [PrismaSchoolServiceCatalogId.INGLES]: SchoolServiceCatalogId.INGLES,
  [PrismaSchoolServiceCatalogId.SEGURANCA]: SchoolServiceCatalogId.SEGURANCA,
  [PrismaSchoolServiceCatalogId.ENFERMARIA]: SchoolServiceCatalogId.ENFERMARIA,
  [PrismaSchoolServiceCatalogId.EXTRA]: SchoolServiceCatalogId.EXTRA,
};

const DOMAIN_SERVICE_TO_PRISMA: Record<
  SchoolServiceCatalogId,
  PrismaSchoolServiceCatalogId
> = {
  [SchoolServiceCatalogId.TRANSPORTE]: PrismaSchoolServiceCatalogId.TRANSPORTE,
  [SchoolServiceCatalogId.CANTINA]: PrismaSchoolServiceCatalogId.CANTINA,
  [SchoolServiceCatalogId.BIBLIOTECA]: PrismaSchoolServiceCatalogId.BIBLIOTECA,
  [SchoolServiceCatalogId.LABORATORIO]:
    PrismaSchoolServiceCatalogId.LABORATORIO,
  [SchoolServiceCatalogId.CAMPO]: PrismaSchoolServiceCatalogId.CAMPO,
  [SchoolServiceCatalogId.INFORMATICA]:
    PrismaSchoolServiceCatalogId.INFORMATICA,
  [SchoolServiceCatalogId.INGLES]: PrismaSchoolServiceCatalogId.INGLES,
  [SchoolServiceCatalogId.SEGURANCA]: PrismaSchoolServiceCatalogId.SEGURANCA,
  [SchoolServiceCatalogId.ENFERMARIA]: PrismaSchoolServiceCatalogId.ENFERMARIA,
  [SchoolServiceCatalogId.EXTRA]: PrismaSchoolServiceCatalogId.EXTRA,
};

@Injectable()
export class PrismaMarketplaceSearchQuery {
  constructor(private readonly prisma: PrismaService) {}

  async findVisibleSchools(
    filters: MarketplaceSearchFilters,
    now = new Date(),
  ): Promise<MarketplaceSchoolRow[]> {
    // teachingType ainda não existe na BD — só PRIVATE é suportado.
    if (filters.teachingType && filters.teachingType !== 'PRIVATE') {
      return [];
    }

    const where = this.buildWhere(filters, now);
    const rows = await this.prisma.school.findMany({
      where,
      include: {
        location: true,
        classes: { where: { isActive: true } },
        services: true,
        price: { include: { levels: true } },
        gallery: {
          where: { kind: GalleryKind.PHOTO },
          orderBy: { order: 'asc' },
          take: 1,
        },
        reviews: {
          where: { isPublished: true },
          select: { rating: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => this.toRow(row));
  }

  async findVisibleByIds(
    ids: string[],
    now = new Date(),
  ): Promise<MarketplaceSchoolRow[]> {
    if (!ids.length) return [];
    const rows = await this.prisma.school.findMany({
      where: {
        id: { in: ids },
        status: SchoolStatus.ACTIVE,
        subscriptions: {
          some: {
            status: SubscriptionStatus.ACTIVE,
            AND: [
              { OR: [{ startDate: null }, { startDate: { lte: now } }] },
              { OR: [{ endDate: null }, { endDate: { gt: now } }] },
            ],
          },
        },
      },
      include: {
        location: true,
        classes: { where: { isActive: true } },
        services: true,
        price: { include: { levels: true } },
        gallery: {
          where: { kind: GalleryKind.PHOTO },
          orderBy: { order: 'asc' },
          take: 1,
        },
        reviews: {
          where: { isPublished: true },
          select: { rating: true },
        },
      },
    });
    return rows.map((row) => this.toRow(row));
  }

  private buildWhere(
    filters: MarketplaceSearchFilters,
    now: Date,
  ): Prisma.SchoolWhereInput {
    const and: Prisma.SchoolWhereInput[] = [
      { status: SchoolStatus.ACTIVE },
      {
        subscriptions: {
          some: {
            status: SubscriptionStatus.ACTIVE,
            AND: [
              { OR: [{ startDate: null }, { startDate: { lte: now } }] },
              { OR: [{ endDate: null }, { endDate: { gt: now } }] },
            ],
          },
        },
      },
    ];

    if (filters.province?.trim()) {
      and.push({
        location: { province: { equals: filters.province.trim(), mode: 'insensitive' } },
      });
    }
    if (filters.municipality?.trim()) {
      and.push({
        location: {
          municipality: {
            equals: filters.municipality.trim(),
            mode: 'insensitive',
          },
        },
      });
    }
    if (filters.classLabel?.trim()) {
      and.push({
        classes: {
          some: {
            isActive: true,
            classLabel: {
              equals: filters.classLabel.trim(),
              mode: 'insensitive',
            },
          },
        },
      });
    }
    if (filters.fullDay) {
      and.push({
        classes: { some: { isActive: true, shift: Shift.DOUBLE } },
      });
    }
    if (filters.tuitionMax != null) {
      and.push({
        price: {
          levels: {
            some: {
              tuitionFeeMin: { lte: filters.tuitionMax },
            },
          },
        },
      });
    }
    for (const serviceId of filters.serviceIds) {
      and.push({
        services: {
          some: { serviceId: DOMAIN_SERVICE_TO_PRISMA[serviceId] },
        },
      });
    }

    const q = filters.q?.trim();
    if (q) {
      and.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { location: { province: { contains: q, mode: 'insensitive' } } },
          {
            location: { municipality: { contains: q, mode: 'insensitive' } },
          },
          {
            location: { neighborhood: { contains: q, mode: 'insensitive' } },
          },
          {
            location: { address: { contains: q, mode: 'insensitive' } },
          },
          {
            classes: {
              some: {
                isActive: true,
                classLabel: { contains: q, mode: 'insensitive' },
              },
            },
          },
        ],
      });
    }

    return { AND: and };
  }

  private toRow(
    row: Prisma.SchoolGetPayload<{
      include: {
        location: true;
        classes: true;
        services: true;
        price: { include: { levels: true } };
        gallery: true;
        reviews: { select: { rating: true } };
      };
    }>,
  ): MarketplaceSchoolRow {
    const toNumber = (
      value: Prisma.Decimal | number | null,
    ): number | null => {
      if (value == null) return null;
      return typeof value === 'number' ? value : value.toNumber();
    };

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      logoUrl: row.logoUrl,
      coverImageUrl: row.coverImageUrl,
      createdAt: row.createdAt,
      location: row.location
        ? {
            province: row.location.province,
            municipality: row.location.municipality,
            neighborhood: row.location.neighborhood,
            latitude: toNumber(row.location.latitude),
            longitude: toNumber(row.location.longitude),
          }
        : null,
      classes: row.classes.map((c) => ({
        classLabel: c.classLabel,
        vacancies: c.vacancies,
        shift: c.shift as SchoolClassShift,
        isActive: c.isActive,
      })),
      services: row.services.map((s) => ({
        serviceId: PRISMA_SERVICE_TO_DOMAIN[s.serviceId],
      })),
      price: row.price
        ? {
            currency: row.price.currency,
            levels: row.price.levels.map((level) => ({
              levelId: PRISMA_LEVEL_TO_DOMAIN[level.levelId],
              enrollmentFeeMin: toNumber(level.enrollmentFeeMin),
              tuitionFeeMin: toNumber(level.tuitionFeeMin),
            })),
          }
        : null,
      gallery: row.gallery.map((g) => ({
        url: g.url,
        kind: g.kind,
        order: g.order,
      })),
      reviews: row.reviews,
    };
  }
}
