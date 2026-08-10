import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MembershipStatus,
  Prisma,
  SchoolMembershipRole,
  SchoolStatus,
} from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { SchoolEntitlementService } from '../../../billing/application/services/school-entitlement.service';
import { buildSchoolOnboardingProgress } from '../../application/school-onboarding.progress';

const schoolPublicInclude = {
  location: true,
  classes: { where: { isActive: true }, orderBy: { classLabel: 'asc' as const } },
  services: { orderBy: { serviceId: 'asc' as const } },
  price: true,
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
      currency: true,
      levels: {
        select: {
          levelId: true,
          tuitionFeeMin: true,
          tuitionFeeMax: true,
        },
      },
    },
  },
  gallery: { select: { kind: true } },
} satisfies Prisma.SchoolInclude;

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
        const {
          educationLevels,
          classes,
          price,
          gallery,
          ...school
        } = m.school;

        const toNumber = (
          value: Prisma.Decimal | number | null,
        ): number | null => {
          if (value == null) return null;
          return typeof value === 'number' ? value : value.toNumber();
        };

        const subscription = await this.entitlements.getDashboardSubscription(
          school.id,
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
              educationLevels,
              classes,
              price: price
                ? {
                    currency: price.currency,
                    levels: price.levels.map((level) => ({
                      levelId: level.levelId,
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

    return school;
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

    return { ...school, subscription };
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
}
