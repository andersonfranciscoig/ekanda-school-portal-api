import { Inject, Injectable } from '@nestjs/common';
import { Prisma, SchoolStatus } from '@prisma/client';
import { UseCase } from '../../../../shared/application/use-case';
import { ForbiddenDomainException } from '../../../../shared/domain/exceptions/domain.exception';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { UserRole } from '../../../identity/domain/entities/user.entity';
import { SchoolNotFoundException } from '../../../school/domain/exceptions/school.exceptions';
import {
  SCHOOL_ONBOARDING_QUERY,
  SchoolOnboardingQuery,
} from '../../../school/domain/repositories/school-onboarding.query';
import {
  evaluateSchoolOnboarding,
  SchoolOnboardingReview,
} from '../../../school/domain/services/school-onboarding.evaluator';

export type ViewSchoolsInput = {
  actorRole: UserRole;
  status?: SchoolStatus;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type AdminSchoolListItem = {
  id: string;
  name: string;
  slug: string;
  status: SchoolStatus;
  logoUrl: string | null;
  phone: string | null;
  email: string | null;
  location: { province: string; municipality: string } | null;
  owner: { name: string; email: string } | null;
  createdAt: string;
  submittedForReviewAt: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  subscription: {
    planCode: string;
    planName: string;
    status: string;
  } | null;
};

export type ViewSchoolsOutput = {
  items: AdminSchoolListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type ViewSchoolDetailInput = {
  actorRole: UserRole;
  schoolId: string;
};

export type ViewSchoolDetailOutput = AdminSchoolListItem & {
  description: string | null;
  reviewedByUserId: string | null;
  onboarding: SchoolOnboardingReview | null;
};

const listInclude = {
  location: true,
  memberships: {
    where: { role: 'OWNER' as const, status: 'ACTIVE' as const },
    take: 1,
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
    },
  },
  subscriptions: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    include: { plan: { select: { code: true, name: true } } },
  },
};

type SchoolListRow = Prisma.SchoolGetPayload<{ include: typeof listInclude }>;

@Injectable()
export class ViewSchoolsUseCase
  implements UseCase<ViewSchoolsInput, ViewSchoolsOutput>
{
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SCHOOL_ONBOARDING_QUERY)
    private readonly onboardingQuery: SchoolOnboardingQuery,
  ) {}

  async execute(input: ViewSchoolsInput): Promise<ViewSchoolsOutput> {
    this.assertAdmin(input.actorRole);

    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 20));
    const q = input.q?.trim();

    const where: Prisma.SchoolWhereInput = {
      ...(input.status ? { status: input.status } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { slug: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.school.findMany({
        where,
        include: listInclude,
        orderBy: [{ submittedForReviewAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.school.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.presentListItem(row)),
      total,
      page,
      pageSize,
    };
  }

  async getById(input: ViewSchoolDetailInput): Promise<ViewSchoolDetailOutput> {
    this.assertAdmin(input.actorRole);

    const school = await this.prisma.school.findUnique({
      where: { id: input.schoolId },
      include: listInclude,
    });
    if (!school) throw new SchoolNotFoundException();

    const snapshot = await this.onboardingQuery.findSnapshot(school.id);

    return {
      ...this.presentListItem(school),
      description: school.description,
      reviewedByUserId: school.reviewedByUserId,
      onboarding: snapshot ? evaluateSchoolOnboarding(snapshot) : null,
    };
  }

  private assertAdmin(role: UserRole) {
    if (role !== UserRole.EKANDA_ADMIN) {
      throw new ForbiddenDomainException(
        'Apenas administradores Ekanda podem listar colégios',
      );
    }
  }

  private presentListItem(school: SchoolListRow): AdminSchoolListItem {
    const owner = school.memberships[0]?.user;
    const sub = school.subscriptions[0];
    return {
      id: school.id,
      name: school.name,
      slug: school.slug,
      status: school.status,
      logoUrl: school.logoUrl,
      phone: school.phone,
      email: school.email,
      location: school.location
        ? {
            province: school.location.province,
            municipality: school.location.municipality,
          }
        : null,
      owner: owner
        ? {
            name: `${owner.firstName} ${owner.lastName}`.trim(),
            email: owner.email,
          }
        : null,
      createdAt: school.createdAt.toISOString(),
      submittedForReviewAt: school.submittedForReviewAt?.toISOString() ?? null,
      rejectionReason: school.rejectionReason,
      reviewedAt: school.reviewedAt?.toISOString() ?? null,
      subscription: sub
        ? {
            planCode: sub.plan.code,
            planName: sub.plan.name,
            status: sub.status,
          }
        : null,
    };
  }
}
