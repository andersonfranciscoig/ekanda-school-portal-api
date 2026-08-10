import { Inject, Injectable } from '@nestjs/common';
import {
  EducationLevelCode as PrismaEducationLevelCode,
  GalleryKind,
  Prisma,
  SchoolServiceCatalogId as PrismaSchoolServiceCatalogId,
} from '@prisma/client';
import { UseCase } from '../../../../shared/application/use-case';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import {
  EducationLevelCode,
  SchoolClassShift,
  SchoolServiceCatalogId,
} from '../../../school/domain/school.enums';
import {
  FAVORITE_REPOSITORY,
  FavoriteRepository,
} from '../../domain/marketplace.domain';
import { MarketplaceSchoolCard } from '../../domain/marketplace-search.types';
import { toMarketplaceCard } from '../../domain/services/marketplace-card.mapper';

export type ListMyFavoriteSchoolsInput = {
  userId: string;
};

export type ListMyFavoriteSchoolsOutput = {
  items: Array<
    MarketplaceSchoolCard & {
      favoritedAt: string;
    }
  >;
  totalItems: number;
};

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

@Injectable()
export class ListMyFavoriteSchoolsUseCase
  implements UseCase<ListMyFavoriteSchoolsInput, ListMyFavoriteSchoolsOutput>
{
  constructor(
    @Inject(FAVORITE_REPOSITORY)
    private readonly favorites: FavoriteRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    input: ListMyFavoriteSchoolsInput,
  ): Promise<ListMyFavoriteSchoolsOutput> {
    const favorites = await this.favorites.listByUserId(input.userId);
    if (favorites.length === 0) {
      return { items: [], totalItems: 0 };
    }

    const schoolIds = favorites.map((f) => f.schoolId);
    const schools = await this.prisma.school.findMany({
      where: { id: { in: schoolIds } },
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

    const schoolById = new Map(schools.map((s) => [s.id, s]));
    const emptyFilters = {
      q: null,
      province: null,
      municipality: null,
      classLabel: null,
      tuitionMax: null,
      serviceIds: [] as SchoolServiceCatalogId[],
      fullDay: false,
      teachingType: null,
      sort: 'recommended' as const,
      page: 1,
      pageSize: 48,
      lat: null,
      lng: null,
    };

    const toNumber = (
      value: Prisma.Decimal | number | null,
    ): number | null => {
      if (value == null) return null;
      return typeof value === 'number' ? value : value.toNumber();
    };

    const items = favorites
      .map((favorite) => {
        const school = schoolById.get(favorite.schoolId);
        if (!school) return null;

        const card = toMarketplaceCard(
          {
            id: school.id,
            slug: school.slug,
            name: school.name,
            description: school.description,
            logoUrl: school.logoUrl,
            coverImageUrl: school.coverImageUrl,
            createdAt: school.createdAt,
            location: school.location
              ? {
                  province: school.location.province,
                  municipality: school.location.municipality,
                  neighborhood: school.location.neighborhood,
                  latitude: toNumber(school.location.latitude),
                  longitude: toNumber(school.location.longitude),
                }
              : null,
            classes: school.classes.map((c) => ({
              classLabel: c.classLabel,
              vacancies: c.vacancies,
              shift: c.shift as SchoolClassShift,
              isActive: c.isActive,
            })),
            services: school.services.map((s) => ({
              serviceId: PRISMA_SERVICE_TO_DOMAIN[s.serviceId],
            })),
            price: school.price
              ? {
                  currency: school.price.currency,
                  levels: school.price.levels.map((level) => ({
                    levelId: PRISMA_LEVEL_TO_DOMAIN[level.levelId],
                    enrollmentFeeMin: toNumber(level.enrollmentFeeMin),
                    tuitionFeeMin: toNumber(level.tuitionFeeMin),
                  })),
                }
              : null,
            gallery: school.gallery.map((g) => ({
              url: g.url,
              kind: g.kind,
              order: g.order,
            })),
            reviews: school.reviews,
          },
          emptyFilters,
        );

        return {
          ...card,
          favoritedAt: favorite.createdAt.toISOString(),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item != null);

    return { items, totalItems: items.length };
  }
}
