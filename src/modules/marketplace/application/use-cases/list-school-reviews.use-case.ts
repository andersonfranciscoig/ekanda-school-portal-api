import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { ReviewSchoolNotFoundException } from '../../domain/exceptions/marketplace.exceptions';
import { ReviewDto } from './create-or-update-review.use-case';

export type ListSchoolReviewsInput = {
  schoolId: string;
  page?: number;
  pageSize?: number;
  userId?: string | null;
  deviceId?: string | null;
};

@Injectable()
export class ListSchoolReviewsUseCase
  implements UseCase<ListSchoolReviewsInput, unknown>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ListSchoolReviewsInput) {
    const school = await this.prisma.school.findUnique({
      where: { id: input.schoolId },
      select: { id: true },
    });
    if (!school) throw new ReviewSchoolNotFoundException();

    const page = Math.max(1, Number(input.page ?? 1) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(input.pageSize ?? 10) || 10));

    const where = { schoolId: input.schoolId, isPublished: true };
    const [totalItems, rows, agg] = await this.prisma.$transaction([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.review.aggregate({
        where,
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    const count = agg._count.rating;
    const summary = {
      average:
        count === 0
          ? 0
          : Math.round((agg._avg.rating ?? 0) * 10) / 10,
      count,
    };

    const items: ReviewDto[] = rows.map((row) => {
      const mine = Boolean(
        (input.userId && row.userId === input.userId) ||
          (input.deviceId && row.deviceId === input.deviceId),
      );
      const showAuthor = !row.isAnonymous && row.user;
      return {
        id: row.id,
        schoolId: row.schoolId,
        rating: row.rating,
        comment: row.comment,
        isAnonymous: row.isAnonymous,
        author: showAuthor
          ? {
              id: row.user!.id,
              name: `${row.user!.firstName} ${row.user!.lastName}`.trim(),
            }
          : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        mine,
      };
    });

    return {
      summary,
      items,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize),
      },
    };
  }
}
