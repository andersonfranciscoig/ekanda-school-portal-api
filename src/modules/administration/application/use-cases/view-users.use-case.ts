import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { UseCase } from '../../../../shared/application/use-case';
import { normalizePage } from '../../../../shared/application/pagination';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/domain.exception';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import {
  presentAdminUser,
  presentAdminUserDetail,
} from '../services/admin.presenter';

export type ViewUsersInput = {
  role?: UserRole;
  q?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
};

@Injectable()
export class ViewUsersUseCase implements UseCase<ViewUsersInput, unknown> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ViewUsersInput) {
    const { page, pageSize, skip } = normalizePage(input.page, input.pageSize);
    const q = input.q?.trim();

    const where: Prisma.UserWhereInput = {
      ...(input.role ? { platformRoles: { some: { role: input.role } } } : {}),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { platformRoles: { select: { role: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: rows.map(presentAdminUser),
      total,
      page,
      pageSize,
    };
  }

  async getById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        platformRoles: { select: { role: true } },
        memberships: {
          where: { status: 'ACTIVE' },
          select: {
            role: true,
            school: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!user) throw new EntityNotFoundException('User not found');
    return presentAdminUserDetail(user);
  }
}
