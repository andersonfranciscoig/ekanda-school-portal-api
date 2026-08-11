import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EducationLevelCode as PrismaEducationLevelCode,
  MembershipStatus,
  Prisma,
  SchoolMembershipRole,
  SchoolServiceCatalogId as PrismaSchoolServiceCatalogId,
  SchoolStatus,
} from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { SchoolEntitlementService } from '../../../billing/application/services/school-entitlement.service';
import { SchoolNotFoundException } from '../../domain/exceptions/school.exceptions';
import { buildSchoolOnboardingProgress } from '../../application/school-onboarding.progress';
import {
  EducationLevelCode,
  SchoolServiceCatalogId,
} from '../../domain/school.enums';

const schoolPublicInclude = {
  location: true,
  classes: {
    where: { isActive: true },
    orderBy: { classLabel: 'asc' as const },
  },
  services: { orderBy: { serviceId: 'asc' as const } },
  price: { include: { levels: true } },
  gallery: { orderBy: { order: 'asc' as const } },
  educationLevels: true,
} satisfies Prisma.SchoolInclude;

const schoolMineInclude = {
  location: true,
  educationLevels: { select: { level: true } },
  classes: {
    where: { isActive: true },
    select: { classLabel: true, vacancies: true, shift: true },
  },
  price: {
    select: {
      id: true,
      currency: true,
      otherFees: true,
      levels: {
        select: {
          levelId: true,
          enrollmentFeeMin: true,
          enrollmentFeeMax: true,
          tuitionFeeMin: true,
          tuitionFeeMax: true,
          transportFeeMin: true,
          transportFeeMax: true,
          mealFeeMin: true,
          mealFeeMax: true,
        },
      },
    },
  },
  gallery: { select: { kind: true } },
} satisfies Prisma.SchoolInclude;

const PRISMA_LEVEL_TO_API: Record<
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

const PRISMA_SERVICE_TO_API: Record<
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

function toNumber(
  value: Prisma.Decimal | number | null | undefined,
): number | null {
  if (value == null) return null;
  return typeof value === 'number' ? value : value.toNumber();
}

function feeRange(
  min: Prisma.Decimal | number | null | undefined,
  max: Prisma.Decimal | number | null | undefined,
) {
  return { min: toNumber(min), max: toNumber(max) };
}

function presentPrice(
  price: {
    id: string;
    schoolId: string;
    otherFees: Prisma.Decimal | number | null;
    currency: string;
    createdAt?: Date;
    updatedAt?: Date;
    levels: Array<{
      id?: string;
      levelId: PrismaEducationLevelCode;
      enrollmentFeeMin: Prisma.Decimal | number | null;
      enrollmentFeeMax: Prisma.Decimal | number | null;
      tuitionFeeMin: Prisma.Decimal | number | null;
      tuitionFeeMax: Prisma.Decimal | number | null;
      transportFeeMin: Prisma.Decimal | number | null;
      transportFeeMax: Prisma.Decimal | number | null;
      mealFeeMin: Prisma.Decimal | number | null;
      mealFeeMax: Prisma.Decimal | number | null;
    }>;
  } | null,
) {
  if (!price) return null;
  return {
    id: price.id,
    schoolId: price.schoolId,
    currency: price.currency,
    otherFees: toNumber(price.otherFees),
    createdAt: price.createdAt,
    updatedAt: price.updatedAt,
    levels: price.levels.map((level) => ({
      levelId: PRISMA_LEVEL_TO_API[level.levelId],
      enrollmentFee: feeRange(level.enrollmentFeeMin, level.enrollmentFeeMax),
      tuitionFee: feeRange(level.tuitionFeeMin, level.tuitionFeeMax),
      transportFee: feeRange(level.transportFeeMin, level.transportFeeMax),
      mealFee: feeRange(level.mealFeeMin, level.mealFeeMax),
    })),
  };
}

@Injectable()
export class SchoolHttpQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: SchoolEntitlementService,
  ) {}

  async findMine(userId: string) {
    const memberships = await this.prisma.schoolMembership.findMany({
      where: { userId, status: MembershipStatus.ACTIVE },
      include: { school: { include: schoolMineInclude } },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      memberships.map(async (m) => {
        const { educationLevels, classes, price, gallery, ...school } =
          m.school;

        const subscription = await this.entitlements.getDashboardSubscription(
          school.id,
        );

        const levelsForOnboarding = educationLevels.map(
          (row) => PRISMA_LEVEL_TO_API[row.level],
        );

        return {
          membership: { id: m.id, role: m.role, status: m.status },
          school: {
            ...school,
            subscription,
            onboarding: buildSchoolOnboardingProgress({
              id: school.id,
              status: school.status,
              name: school.name,
              description: school.description,
              servicesConfiguredAt: school.servicesConfiguredAt,
              location: school.location
                ? {
                    province: school.location.province,
                    municipality: school.location.municipality,
                  }
                : null,
              educationLevels: levelsForOnboarding.map((level) => ({
                level,
              })),
              classes,
              price: price
                ? {
                    currency: price.currency,
                    levels: price.levels.map((level) => ({
                      levelId: PRISMA_LEVEL_TO_API[level.levelId],
                      tuitionFeeMin: toNumber(level.tuitionFeeMin),
                      tuitionFeeMax: toNumber(level.tuitionFeeMax),
                    })),
                  }
                : null,
              gallery,
            }),
          },
        };
      }),
    );
  }

  async findPublicBySlug(slug: string) {
    const school = await this.prisma.school.findFirst({
      where: { slug: slug.toLowerCase(), status: SchoolStatus.ACTIVE },
      include: schoolPublicInclude,
    });
    if (!school) throw new NotFoundException('Colégio não encontrado');

    const visible = await this.entitlements.isPublicProfileVisible(school.id);
    if (!visible) throw new NotFoundException('Colégio não encontrado');

    return this.presentSchoolDetail(school);
  }

  async findBySlugForAdmin(slug: string) {
    const school = await this.prisma.school.findFirst({
      where: { slug: slug.toLowerCase() },
      include: {
        ...schoolPublicInclude,
        memberships: {
          where: { status: MembershipStatus.ACTIVE },
          select: {
            id: true,
            role: true,
            status: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });
    if (!school) throw new SchoolNotFoundException();

    const subscription = await this.entitlements.getDashboardSubscription(
      school.id,
    );

    return {
      ...this.presentSchoolDetail(school),
      memberships: school.memberships,
      subscription,
    };
  }

  async findOneForMember(schoolId: string, userId: string) {
    await this.assertMembership(schoolId, userId);
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      include: {
        ...schoolPublicInclude,
        memberships: {
          where: { status: MembershipStatus.ACTIVE },
          select: {
            id: true,
            role: true,
            status: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });
    if (!school) throw new NotFoundException('Colégio não encontrado');

    const subscription =
      await this.entitlements.getDashboardSubscription(schoolId);

    return {
      ...this.presentSchoolDetail(school),
      memberships: school.memberships,
      subscription,
    };
  }

  async findCreatedDetail(schoolId: string, ownerUserId: string) {
    return this.prisma.school.findUnique({
      where: { id: schoolId },
      include: {
        location: true,
        memberships: {
          where: { userId: ownerUserId },
          select: { id: true, role: true, status: true },
        },
      },
    });
  }

  async updateProfile(
    schoolId: string,
    userId: string,
    data: {
      name?: string;
      description?: string;
      phone?: string;
      email?: string;
      website?: string;
      logoUrl?: string;
      coverImageUrl?: string;
    },
  ) {
    await this.assertMembership(schoolId, userId, [
      SchoolMembershipRole.OWNER,
      SchoolMembershipRole.ADMIN,
    ]);

    return this.prisma.school.update({
      where: { id: schoolId },
      data: {
        name: data.name?.trim(),
        description: data.description?.trim(),
        phone: data.phone?.trim(),
        email: data.email?.trim().toLowerCase(),
        website: data.website?.trim(),
        logoUrl: data.logoUrl?.trim(),
        coverImageUrl: data.coverImageUrl?.trim(),
      },
      include: { location: true },
    });
  }

  async assertMembership(
    schoolId: string,
    userId: string,
    roles?: SchoolMembershipRole[],
  ) {
    const membership = await this.prisma.schoolMembership.findUnique({
      where: { userId_schoolId: { userId, schoolId } },
    });

    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException(
        'Não tem acesso a este colégio. Isolamento multi-tenant aplicado.',
      );
    }

    if (roles?.length && !roles.includes(membership.role)) {
      throw new ForbiddenException('Permissão insuficiente neste colégio');
    }

    return membership;
  }

  private presentSchoolDetail(
    school: Prisma.SchoolGetPayload<{ include: typeof schoolPublicInclude }>,
  ) {
    const { price, services, educationLevels, ...rest } = school;

    return {
      ...rest,
      educationLevels: educationLevels.map((row) => ({
        ...row,
        level: PRISMA_LEVEL_TO_API[row.level],
      })),
      services: services.map((row) => ({
        ...row,
        serviceId: PRISMA_SERVICE_TO_API[row.serviceId],
      })),
      price: presentPrice(price),
    };
  }
}
