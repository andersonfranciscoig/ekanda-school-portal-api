import { Injectable } from '@nestjs/common';
import { ConciergeVisitStatus, Prisma } from '@prisma/client';
import { UseCase } from '../../../../shared/application/use-case';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { SchoolAccessAuthorizer } from '../../../school/application/services/school-access.authorizer';
import {
  ConciergeConflictException,
  ConciergeVisitNotFoundException,
} from '../../domain/exceptions/concierge.exceptions';
import { presentConciergeVisit } from '../../infrastructure/http/concierge-visit.presenter';

const schoolSelect = { id: true, name: true, slug: true } as const;

export type ListSchoolVisitsInput = {
  schoolId: string;
  actorUserId: string;
  status?: ConciergeVisitStatus;
  page?: number;
  pageSize?: number;
};

export type ListMyVisitsInput = {
  userId: string;
  page?: number;
  pageSize?: number;
};

export type DecideVisitInput = {
  visitId: string;
  actorUserId: string;
  action: 'confirm' | 'reject';
  rejectionReason?: string;
};

@Injectable()
export class ListSchoolConciergeVisitsUseCase
  implements UseCase<ListSchoolVisitsInput, unknown>
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SchoolAccessAuthorizer,
  ) {}

  async execute(input: ListSchoolVisitsInput) {
    await this.access.assertCanManageSchool(input.actorUserId, input.schoolId);

    const page = Math.max(1, Number(input.page ?? 1) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(input.pageSize ?? 20) || 20));
    const where: Prisma.ConciergeVisitWhereInput = {
      schoolId: input.schoolId,
      ...(input.status ? { status: input.status } : {}),
    };

    const [totalItems, rows] = await this.prisma.$transaction([
      this.prisma.conciergeVisit.count({ where }),
      this.prisma.conciergeVisit.findMany({
        where,
        include: { school: { select: schoolSelect } },
        orderBy: [{ date: 'asc' }, { time: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map(presentConciergeVisit),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      },
      counts: await this.countByStatus(input.schoolId),
    };
  }

  private async countByStatus(schoolId: string) {
    const groups = await this.prisma.conciergeVisit.groupBy({
      by: ['status'],
      where: { schoolId },
      _count: { _all: true },
    });
    const base: Record<string, number> = {
      PENDING_SCHOOL_CONFIRMATION: 0,
      CONFIRMED: 0,
      REJECTED: 0,
      CANCELLED: 0,
      COMPLETED: 0,
    };
    for (const g of groups) base[g.status] = g._count._all;
    return base;
  }
}

@Injectable()
export class ListMyConciergeVisitsUseCase
  implements UseCase<ListMyVisitsInput, unknown>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ListMyVisitsInput) {
    const page = Math.max(1, Number(input.page ?? 1) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(input.pageSize ?? 20) || 20));
    const where: Prisma.ConciergeVisitWhereInput = { userId: input.userId };

    const [totalItems, rows] = await this.prisma.$transaction([
      this.prisma.conciergeVisit.count({ where }),
      this.prisma.conciergeVisit.findMany({
        where,
        include: { school: { select: schoolSelect } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map(presentConciergeVisit),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      },
    };
  }
}

@Injectable()
export class DecideConciergeVisitUseCase
  implements UseCase<DecideVisitInput, unknown>
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SchoolAccessAuthorizer,
  ) {}

  async execute(input: DecideVisitInput) {
    const visit = await this.prisma.conciergeVisit.findUnique({
      where: { id: input.visitId },
      include: { school: { select: schoolSelect } },
    });
    if (!visit) throw new ConciergeVisitNotFoundException();

    await this.access.assertCanManageSchool(input.actorUserId, visit.schoolId);

    if (visit.status !== ConciergeVisitStatus.PENDING_SCHOOL_CONFIRMATION) {
      throw new ConciergeConflictException(
        'Only pending visits can be confirmed or rejected',
      );
    }

    if (input.action === 'reject') {
      const reason = input.rejectionReason?.trim() ?? '';
      if (reason.length < 5) {
        throw new ConciergeConflictException(
          'rejectionReason must have at least 5 characters',
        );
      }
    }

    const updated = await this.prisma.conciergeVisit.update({
      where: { id: visit.id },
      data:
        input.action === 'confirm'
          ? {
              status: ConciergeVisitStatus.CONFIRMED,
              rejectionReason: null,
              decidedAt: new Date(),
              decidedByUserId: input.actorUserId,
            }
          : {
              status: ConciergeVisitStatus.REJECTED,
              rejectionReason: input.rejectionReason!.trim(),
              decidedAt: new Date(),
              decidedByUserId: input.actorUserId,
            },
      include: { school: { select: schoolSelect } },
    });

    return presentConciergeVisit(updated);
  }
}
