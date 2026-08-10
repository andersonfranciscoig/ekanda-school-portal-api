import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../shared/infrastructure/persistence/prisma/prisma.service';
import {
  Favorite,
  FavoriteRepository,
} from '../../../domain/marketplace.domain';

@Injectable()
export class PrismaFavoriteRepository implements FavoriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async add(favorite: Favorite): Promise<Favorite> {
    try {
      const record = await this.prisma.favorite.create({
        data: {
          id: favorite.id,
          userId: favorite.userId,
          schoolId: favorite.schoolId,
          createdAt: favorite.createdAt,
        },
      });
      return Favorite.rehydrate(record);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.findByUserAndSchool(
          favorite.userId,
          favorite.schoolId,
        );
        if (existing) return existing;
      }
      throw error;
    }
  }

  async remove(userId: string, schoolId: string): Promise<boolean> {
    const result = await this.prisma.favorite.deleteMany({
      where: { userId, schoolId },
    });
    return result.count > 0;
  }

  async exists(userId: string, schoolId: string): Promise<boolean> {
    const count = await this.prisma.favorite.count({
      where: { userId, schoolId },
    });
    return count > 0;
  }

  async findByUserAndSchool(
    userId: string,
    schoolId: string,
  ): Promise<Favorite | null> {
    const record = await this.prisma.favorite.findUnique({
      where: { userId_schoolId: { userId, schoolId } },
    });
    return record ? Favorite.rehydrate(record) : null;
  }

  async listByUserId(userId: string): Promise<Favorite[]> {
    const rows = await this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => Favorite.rehydrate(row));
  }
}
