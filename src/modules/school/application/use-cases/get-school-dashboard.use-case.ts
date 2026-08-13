import { Injectable } from '@nestjs/common';
import { Prisma, SchoolStatus } from '@prisma/client';
import { UseCase } from '../../../../shared/application/use-case';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { SchoolEntitlementService } from '../../../billing/application/services/school-entitlement.service';
import { buildSchoolOnboardingProgress } from '../school-onboarding.progress';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';
import { SchoolNotFoundException } from '../../domain/exceptions/school.exceptions';
import { PENDING_APPLICATION_STATUSES } from '../../../application/application/services/application.presenter';

export type GetSchoolDashboardInput = {
  schoolId: string;
  actorUserId: string;
};

const PT_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;
const PT_MONTHS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const;

function toNumber(
  value: Prisma.Decimal | number | null | undefined,
): number | null {
  if (value == null) return null;
  return typeof value === 'number' ? value : value.toNumber();
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatActivityDate(date: Date) {
  return date.toLocaleString('pt-AO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function relativeTime(from: Date, now = new Date()) {
  const diffMs = now.getTime() - from.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Agora';
  if (mins < 60) return `Há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Ontem';
  if (days < 7) return `Há ${days} dias`;
  return formatActivityDate(from);
}

@Injectable()
export class GetSchoolDashboardUseCase
  implements UseCase<GetSchoolDashboardInput, unknown>
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorizer: SchoolAccessAuthorizer,
    private readonly entitlements: SchoolEntitlementService,
  ) {}

  async execute(input: GetSchoolDashboardInput) {
    await this.authorizer.assertCanManageSchool(
      input.actorUserId,
      input.schoolId,
    );

    const now = new Date();
    const school = await this.prisma.school.findUnique({
      where: { id: input.schoolId },
      include: {
        location: true,
        classes: { where: { isActive: true } },
        price: { include: { levels: true } },
        gallery: { select: { kind: true }, take: 1, orderBy: { order: 'asc' } },
        educationLevels: true,
      },
    });

    if (!school) {
      throw new SchoolNotFoundException();
    }

    const subscription = await this.entitlements.getDashboardSubscription(
      input.schoolId,
      now,
    );

    const [
      profileViews,
      profileViewsPrev,
      viewsByDayRows,
      reviewAgg,
      appCounts,
      recentApps,
      appsByMonth,
      topClassesRows,
    ] = await Promise.all([
      this.prisma.schoolProfileView.count({
        where: { schoolId: input.schoolId },
      }),
      this.countViewsInRange(
        input.schoolId,
        daysAgo(60, now),
        daysAgo(30, now),
      ),
      this.prisma.schoolProfileView.findMany({
        where: {
          schoolId: input.schoolId,
          viewedAt: { gte: daysAgo(6, now) },
        },
        select: { viewedAt: true },
      }),
      this.prisma.review.aggregate({
        where: { schoolId: input.schoolId, isPublished: true },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      Promise.all([
        this.prisma.application.count({ where: { schoolId: input.schoolId } }),
        this.prisma.application.count({
          where: {
            schoolId: input.schoolId,
            status: { in: PENDING_APPLICATION_STATUSES },
          },
        }),
      ]),
      this.prisma.application.findMany({
        where: { schoolId: input.schoolId },
        include: {
          student: { select: { firstName: true, lastName: true } },
          schoolClass: { select: { classLabel: true } },
        },
        orderBy: { submittedAt: 'desc' },
        take: 5,
      }),
      this.loadApplicationsByMonth(input.schoolId, 6, now),
      this.loadTopClasses(input.schoolId),
    ]);

    const viewsLast30 = await this.countViewsInRange(
      input.schoolId,
      daysAgo(30, now),
      now,
    );
    const profileViewsTrendPercent =
      profileViewsPrev > 0
        ? Math.round(((viewsLast30 - profileViewsPrev) / profileViewsPrev) * 100)
        : viewsLast30 > 0
          ? 100
          : null;

    const availableVacancies = school.classes.reduce(
      (sum, row) => sum + (row.vacancies ?? 0),
      0,
    );
    const classesCount = school.classes.length;

    const tuitionValues = (school.price?.levels ?? [])
      .flatMap((level) => [
        toNumber(level.tuitionFeeMin),
        toNumber(level.tuitionFeeMax),
      ])
      .filter((v): v is number => v != null && v > 0);
    const averageTuition =
      tuitionValues.length > 0
        ? Math.round(
            tuitionValues.reduce((a, b) => a + b, 0) / tuitionValues.length,
          )
        : null;

    const viewsByDay = buildLast7DaysViews(viewsByDayRows, now);
    const applicationsByMonth = appsByMonth;
    const topClasses = topClassesRows;

    const onboarding = buildSchoolOnboardingProgress({
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
      educationLevels: school.educationLevels.map((row) => ({ level: row.level })),
      classes: school.classes.map((row) => ({
        classLabel: row.classLabel,
        vacancies: row.vacancies,
        shift: row.shift,
      })),
      price: school.price
        ? {
            currency: school.price.currency,
            levels: school.price.levels.map((level) => ({
              levelId: level.levelId,
              tuitionFeeMin: toNumber(level.tuitionFeeMin),
              tuitionFeeMax: toNumber(level.tuitionFeeMax),
            })),
          }
        : null,
      gallery: school.gallery,
    });

    const activity = buildActivityTimeline(school, recentApps, now);
    const [applicationsTotal, applicationsPending] = appCounts;

    const planCode = subscription?.planCode ?? null;
    const planId =
      planCode === 'MANAGEMENT'
        ? 'gestao'
        : planCode
          ? 'presenca'
          : null;

    return {
      school: {
        id: school.id,
        name: school.name,
        slug: school.slug,
        status: school.status,
        logoUrl: school.logoUrl,
        phone: school.phone,
        email: school.email,
        description: school.description,
        rejectionReason: school.rejectionReason,
        location: school.location,
      },
      subscription: {
        planId,
        planName: subscription?.planName ?? null,
        status: subscription?.status ?? 'draft',
        activatedAt: subscription?.startDate ?? null,
        expiresAt: subscription?.endDate ?? null,
      },
      applications: {
        total: applicationsTotal,
        pending: applicationsPending,
        recent: recentApps.map((app) => ({
          id: app.id,
          studentName: `${app.student.firstName} ${app.student.lastName}`.trim(),
          classLabel: app.schoolClass?.classLabel ?? '—',
          createdAt: app.submittedAt.toISOString(),
        })),
      },
      analytics: {
        profileViews: school.status === SchoolStatus.ACTIVE ? profileViews : null,
        profileViewsTrendPercent:
          school.status === SchoolStatus.ACTIVE ? profileViewsTrendPercent : null,
        availableVacancies,
        classesCount,
        averageTuition,
        ratingAverage: reviewAgg._avg.rating
          ? Number(reviewAgg._avg.rating.toFixed(1))
          : null,
        ratingCount: reviewAgg._count._all,
        viewsByDay,
        applicationsByMonth,
        topClasses,
      },
      onboarding,
      activity,
    };
  }

  private async countViewsInRange(
    schoolId: string,
    from: Date,
    to: Date,
  ) {
    return this.prisma.schoolProfileView.count({
      where: { schoolId, viewedAt: { gte: from, lt: to } },
    });
  }

  private async loadApplicationsByMonth(
    schoolId: string,
    months: number,
    now: Date,
  ) {
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
    const rows = await this.prisma.application.findMany({
      where: { schoolId, submittedAt: { gte: start } },
      select: { submittedAt: true },
    });

    const buckets = new Map<string, number>();
    for (let i = months - 1; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      buckets.set(key, 0);
    }

    for (const row of rows) {
      const d = row.submittedAt;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (buckets.has(key)) {
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }
    }

    return Array.from(buckets.entries()).map(([key, value]) => {
      const [year, month] = key.split('-').map(Number);
      return {
        month: PT_MONTHS[month!] ?? '—',
        value,
      };
    });
  }

  private async loadTopClasses(schoolId: string) {
    const rows = await this.prisma.application.groupBy({
      by: ['schoolClassId'],
      where: { schoolId, schoolClassId: { not: null } },
      _count: { _all: true },
    });

    const sorted = [...rows].sort((a, b) => b._count._all - a._count._all).slice(0, 5);

    if (!sorted.length) {
      const classes = await this.prisma.schoolClass.findMany({
        where: { schoolId, isActive: true },
        select: { classLabel: true, vacancies: true },
        orderBy: { vacancies: 'desc' },
        take: 5,
      });
      return classes.map((row) => ({
        classLabel: row.classLabel,
        interest: row.vacancies ?? 0,
      }));
    }

    const classIds = sorted
      .map((row) => row.schoolClassId)
      .filter((id): id is string => Boolean(id));
    const classMap = new Map(
      (
        await this.prisma.schoolClass.findMany({
          where: { id: { in: classIds } },
          select: { id: true, classLabel: true },
        })
      ).map((row) => [row.id, row.classLabel]),
    );

    return sorted.map((row) => ({
      classLabel: classMap.get(row.schoolClassId!) ?? '—',
      interest: row._count._all,
    }));
  }
}

function daysAgo(n: number, from: Date) {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return d;
}

function buildLast7DaysViews(rows: Array<{ viewedAt: Date }>, now: Date) {
  const buckets = new Map<string, number>();
  for (let i = 6; i >= 0; i -= 1) {
    const d = startOfDay(daysAgo(i, now));
    buckets.set(d.toISOString(), 0);
  }

  for (const row of rows) {
    const key = startOfDay(row.viewedAt).toISOString();
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }

  return Array.from(buckets.entries()).map(([iso, value]) => {
    const date = new Date(iso);
    return {
      day: PT_DAYS[date.getDay()] ?? '—',
      value,
    };
  });
}

function buildActivityTimeline(
  school: {
    createdAt: Date;
    submittedForReviewAt: Date | null;
    reviewedAt: Date | null;
    status: SchoolStatus;
    updatedAt: Date;
  },
  recentApps: Array<{ submittedAt: Date; student: { firstName: string; lastName: string } }>,
  now: Date,
) {
  const items: Array<{ title: string; at: string | null; pending?: boolean }> = [];

  items.push({
    title: 'Perfil criado',
    at: formatActivityDate(school.createdAt),
  });

  if (school.submittedForReviewAt) {
    items.push({
      title: 'Cadastro enviado para análise',
      at: formatActivityDate(school.submittedForReviewAt),
    });
  }

  if (school.status === SchoolStatus.ACTIVE && school.reviewedAt) {
    items.push({
      title: 'Perfil publicado',
      at: formatActivityDate(school.reviewedAt),
    });
  } else if (school.status === SchoolStatus.PENDING_REVIEW) {
    items.push({
      title: 'Perfil publicado',
      at: null,
      pending: true,
    });
  }

  for (const app of recentApps.slice(0, 2)) {
    items.push({
      title: `Pedido de matrícula — ${app.student.firstName} ${app.student.lastName}`.trim(),
      at: relativeTime(app.submittedAt, now),
    });
  }

  if (school.updatedAt.getTime() - school.createdAt.getTime() > 60_000) {
    items.push({
      title: 'Perfil actualizado',
      at: formatActivityDate(school.updatedAt),
    });
  }

  return items.slice(0, 6);
}
