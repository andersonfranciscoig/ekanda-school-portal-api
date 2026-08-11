import { Injectable } from '@nestjs/common';
import { ApplicationStatus, Prisma } from '@prisma/client';
import { UseCase } from '../../../../shared/application/use-case';
import { normalizePage } from '../../../../shared/application/pagination';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import {
  applicationListInclude,
  PENDING_APPLICATION_STATUSES,
  presentApplicationListItem,
} from '../services/application.presenter';

export type ListApplicationsInput = {
  schoolId?: string;
  status?: ApplicationStatus;
  q?: string;
  page?: number;
  pageSize?: number;
  includeCounts?: boolean;
};

@Injectable()
export class ListApplicationsUseCase
  implements UseCase<ListApplicationsInput, unknown>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ListApplicationsInput) {
    const { page, pageSize, skip } = normalizePage(input.page, input.pageSize);
    const where = await this.buildWhere(input);

    const [rows, total, counts] = await Promise.all([
      this.prisma.application.findMany({
        where,
        include: applicationListInclude,
        orderBy: { submittedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.application.count({ where }),
      input.includeCounts && input.schoolId
        ? this.loadCounts(input.schoolId)
        : Promise.resolve(null),
    ]);

    return {
      items: rows.map(presentApplicationListItem),
      total,
      page,
      pageSize,
      ...(counts ? { counts } : {}),
    };
  }

  private async loadCounts(schoolId: string) {
    const [total, pending] = await Promise.all([
      this.prisma.application.count({ where: { schoolId } }),
      this.prisma.application.count({
        where: { schoolId, status: { in: PENDING_APPLICATION_STATUSES } },
      }),
    ]);
    return { total, pending };
  }

  private async buildWhere(
    input: ListApplicationsInput,
  ): Promise<Prisma.ApplicationWhereInput> {
    const q = input.q?.trim();
    const codePrefix = this.codePrefix(q);
    const codeIds = codePrefix ? await this.idsMatchingCode(codePrefix) : [];

    const or: Prisma.ApplicationWhereInput[] = [];
    if (q) {
      if (codeIds.length) or.push({ id: { in: codeIds } });
      or.push({
        student: {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
          ],
        },
      });
      or.push({
        guardian: {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
          ],
        },
      });
      or.push({
        school: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
          ],
        },
      });
    }

    return {
      ...(input.schoolId ? { schoolId: input.schoolId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(or.length ? { OR: or } : {}),
    };
  }

  private async idsMatchingCode(prefix: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM applications
      WHERE REPLACE(id::text, '-', '') ILIKE ${`${prefix}%`}
      LIMIT 50
    `;
    return rows.map((row) => row.id);
  }

  private codePrefix(q?: string): string | undefined {
    if (!q) return undefined;
    const match = q.trim().match(/^EKD-APP-([0-9a-f]{4,12})$/i);
    return match?.[1]?.toLowerCase();
  }
}
