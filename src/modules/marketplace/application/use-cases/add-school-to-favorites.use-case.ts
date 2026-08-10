import { Inject, Injectable } from '@nestjs/common';
import { SchoolStatus, SubscriptionStatus } from '@prisma/client';
import { UseCase } from '../../../../shared/application/use-case';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import {
  Favorite,
  FAVORITE_REPOSITORY,
  FavoriteRepository,
} from '../../domain/marketplace.domain';
import {
  FavoriteSchoolNotFoundException,
  SchoolNotEligibleForFavoriteException,
} from '../../domain/exceptions/marketplace.exceptions';

export type AddSchoolToFavoritesInput = {
  userId: string;
  schoolId: string;
};

export type AddSchoolToFavoritesOutput = {
  id: string;
  schoolId: string;
  userId: string;
  createdAt: string;
  created: boolean;
};

@Injectable()
export class AddSchoolToFavoritesUseCase
  implements UseCase<AddSchoolToFavoritesInput, AddSchoolToFavoritesOutput>
{
  constructor(
    @Inject(FAVORITE_REPOSITORY)
    private readonly favorites: FavoriteRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    input: AddSchoolToFavoritesInput,
  ): Promise<AddSchoolToFavoritesOutput> {
    const school = await this.prisma.school.findUnique({
      where: { id: input.schoolId },
      select: { id: true, status: true },
    });
    if (!school) {
      throw new FavoriteSchoolNotFoundException();
    }
    if (school.status !== SchoolStatus.ACTIVE) {
      throw new SchoolNotEligibleForFavoriteException();
    }

    const now = new Date();
    const validSub = await this.prisma.subscription.findFirst({
      where: {
        schoolId: input.schoolId,
        status: SubscriptionStatus.ACTIVE,
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: now } }] },
          { OR: [{ endDate: null }, { endDate: { gt: now } }] },
        ],
      },
      select: { id: true },
    });
    if (!validSub) {
      throw new SchoolNotEligibleForFavoriteException(
        'School is not publicly listed (missing valid subscription)',
      );
    }

    const existing = await this.favorites.findByUserAndSchool(
      input.userId,
      input.schoolId,
    );
    if (existing) {
      return {
        id: existing.id,
        schoolId: existing.schoolId,
        userId: existing.userId,
        createdAt: existing.createdAt.toISOString(),
        created: false,
      };
    }

    const favorite = await this.favorites.add(
      Favorite.create({
        id: crypto.randomUUID(),
        userId: input.userId,
        schoolId: input.schoolId,
      }),
    );

    return {
      id: favorite.id,
      schoolId: favorite.schoolId,
      userId: favorite.userId,
      createdAt: favorite.createdAt.toISOString(),
      created: true,
    };
  }
}
