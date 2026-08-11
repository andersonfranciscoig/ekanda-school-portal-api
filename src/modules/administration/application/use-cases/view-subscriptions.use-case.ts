import { Injectable } from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import { UseCase } from '../../../../shared/application/use-case';
import { normalizePage } from '../../../../shared/application/pagination';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/domain.exception';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { presentAdminSubscription } from '../services/admin.presenter';

import { AdminSubscriptionStatusFilter } from '../../infrastructure/http/dto/admin-subscriptions.http-dto';

export type ViewSubscriptionsInput = {
  status?: AdminSubscriptionStatusFilter;
  q?: string;
  schoolId?: string;
  page?: number;
  pageSize?: number;
};

const subscriptionInclude = {
  school: { select: { id: true, name: true, slug: true } },
  plan: {
    select: { id: true, code: true, name: true, price: true, currency: true },
  },
} satisfies Prisma.SubscriptionInclude;

@Injectable()
export class ViewSubscriptionsUseCase
  implements UseCase<ViewSubscriptionsInput, unknown>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ViewSubscriptionsInput) {
    const { page, pageSize, skip } = normalizePage(input.page, input.pageSize);
    const where = this.buildWhere(input);

    const [rows, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        include: subscriptionInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return {
      items: rows.map((row) => presentAdminSubscription(row)),
      total,
      page,
      pageSize,
    };
  }

  async getById(subscriptionId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: subscriptionInclude,
    });
    if (!subscription) throw new EntityNotFoundException('Subscription not found');
    return presentAdminSubscription(subscription);
  }

  private buildWhere(input: ViewSubscriptionsInput): Prisma.SubscriptionWhereInput {
    const q = input.q?.trim();
    const now = new Date();
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    let statusWhere: Prisma.SubscriptionWhereInput = {};
    if (input.status === 'EXPIRING_SOON') {
      statusWhere = {
        status: SubscriptionStatus.ACTIVE,
        endDate: { gt: now, lte: in14Days },
      };
    } else if (input.status === 'EXPIRED') {
      statusWhere = {
        OR: [
          { status: SubscriptionStatus.EXPIRED },
          { status: SubscriptionStatus.ACTIVE, endDate: { lte: now } },
        ],
      };
    } else if (input.status === 'ACTIVE') {
      statusWhere = {
        status: SubscriptionStatus.ACTIVE,
        OR: [{ endDate: null }, { endDate: { gt: now } }],
      };
    } else if (input.status) {
      statusWhere = { status: input.status };
    }

    return {
      ...statusWhere,
      ...(input.schoolId ? { schoolId: input.schoolId } : {}),
      ...(q
        ? {
            school: {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { slug: { contains: q, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };
  }
}
