import { SchoolStatus } from '@prisma/client';
import {
  FavoriteSchoolNotFoundException,
  SchoolNotEligibleForFavoriteException,
} from '../../domain/exceptions/marketplace.exceptions';
import { Favorite } from '../../domain/marketplace.domain';
import { AddSchoolToFavoritesUseCase } from './add-school-to-favorites.use-case';
import { RemoveSchoolFromFavoritesUseCase } from './remove-school-from-favorites.use-case';
import { ListMyFavoriteSchoolsUseCase } from './list-my-favorite-schools.use-case';

describe('Favorites use cases', () => {
  const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const schoolId = '11111111-1111-1111-1111-111111111111';

  describe('AddSchoolToFavoritesUseCase', () => {
    let favorites: {
      findByUserAndSchool: jest.Mock;
      add: jest.Mock;
    };
    let prisma: {
      school: { findUnique: jest.Mock };
      subscription: { findFirst: jest.Mock };
    };
    let useCase: AddSchoolToFavoritesUseCase;

    beforeEach(() => {
      favorites = {
        findByUserAndSchool: jest.fn().mockResolvedValue(null),
        add: jest.fn(async (f: Favorite) => f),
      };
      prisma = {
        school: {
          findUnique: jest.fn().mockResolvedValue({
            id: schoolId,
            status: SchoolStatus.ACTIVE,
          }),
        },
        subscription: {
          findFirst: jest.fn().mockResolvedValue({ id: 'sub-1' }),
        },
      };
      useCase = new AddSchoolToFavoritesUseCase(
        favorites as never,
        prisma as never,
      );
    });

    it('adds favorite when school is ACTIVE with valid subscription', async () => {
      const result = await useCase.execute({ userId, schoolId });
      expect(result.created).toBe(true);
      expect(result.schoolId).toBe(schoolId);
      expect(favorites.add).toHaveBeenCalled();
    });

    it('is idempotent when already favorited', async () => {
      favorites.findByUserAndSchool.mockResolvedValue(
        Favorite.create({ id: 'fav-1', userId, schoolId }),
      );
      const result = await useCase.execute({ userId, schoolId });
      expect(result.created).toBe(false);
      expect(favorites.add).not.toHaveBeenCalled();
    });

    it('rejects missing school', async () => {
      prisma.school.findUnique.mockResolvedValue(null);
      await expect(
        useCase.execute({ userId, schoolId }),
      ).rejects.toBeInstanceOf(FavoriteSchoolNotFoundException);
    });

    it('rejects non-ACTIVE school', async () => {
      prisma.school.findUnique.mockResolvedValue({
        id: schoolId,
        status: SchoolStatus.DRAFT,
      });
      await expect(
        useCase.execute({ userId, schoolId }),
      ).rejects.toBeInstanceOf(SchoolNotEligibleForFavoriteException);
    });
  });

  describe('RemoveSchoolFromFavoritesUseCase', () => {
    it('removes favorite', async () => {
      const favorites = {
        remove: jest.fn().mockResolvedValue(true),
      };
      const useCase = new RemoveSchoolFromFavoritesUseCase(favorites as never);
      const result = await useCase.execute({ userId, schoolId });
      expect(result).toEqual({ schoolId, removed: true });
    });

    it('is idempotent when missing', async () => {
      const favorites = {
        remove: jest.fn().mockResolvedValue(false),
      };
      const useCase = new RemoveSchoolFromFavoritesUseCase(favorites as never);
      const result = await useCase.execute({ userId, schoolId });
      expect(result.removed).toBe(false);
    });
  });

  describe('ListMyFavoriteSchoolsUseCase', () => {
    it('returns empty list', async () => {
      const favorites = {
        listByUserId: jest.fn().mockResolvedValue([]),
      };
      const prisma = { school: { findMany: jest.fn() } };
      const useCase = new ListMyFavoriteSchoolsUseCase(
        favorites as never,
        prisma as never,
      );
      const result = await useCase.execute({ userId });
      expect(result).toEqual({ items: [], totalItems: 0 });
      expect(prisma.school.findMany).not.toHaveBeenCalled();
    });
  });
});
