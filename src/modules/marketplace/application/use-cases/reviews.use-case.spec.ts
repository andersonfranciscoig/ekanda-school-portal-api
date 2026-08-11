import { SchoolStatus } from '@prisma/client';
import { ForbiddenDomainException } from '../../../../shared/domain/exceptions/domain.exception';
import {
  InvalidReviewRatingException,
  ReviewIdentityRequiredException,
  ReviewNotFoundException,
  ReviewSchoolNotEligibleException,
  ReviewSchoolNotFoundException,
} from '../../domain/exceptions/marketplace.exceptions';
import { Review } from '../../domain/marketplace.domain';
import { CreateOrUpdateReviewUseCase } from './create-or-update-review.use-case';
import { DeleteReviewUseCase } from './delete-review.use-case';
import { ListSchoolReviewsUseCase } from './list-school-reviews.use-case';

describe('Review use cases', () => {
  const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const schoolId = '11111111-1111-1111-1111-111111111111';
  const deviceId = 'device-abc';

  describe('CreateOrUpdateReviewUseCase', () => {
    let reviews: {
      save: jest.Mock;
      findByUserAndSchool: jest.Mock;
      findByDeviceAndSchool: jest.Mock;
    };
    let prisma: {
      school: { findUnique: jest.Mock };
      subscription: { findFirst: jest.Mock };
    };
    let useCase: CreateOrUpdateReviewUseCase;

    beforeEach(() => {
      reviews = {
        save: jest.fn().mockResolvedValue(undefined),
        findByUserAndSchool: jest.fn().mockResolvedValue(null),
        findByDeviceAndSchool: jest.fn().mockResolvedValue(null),
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
      useCase = new CreateOrUpdateReviewUseCase(
        reviews as never,
        prisma as never,
      );
    });

    it('creates a named review for a logged-in user', async () => {
      const result = await useCase.execute({
        schoolId,
        rating: 5,
        comment: 'Excelente',
        userId,
      });
      expect(result.created).toBe(true);
      expect(result.isAnonymous).toBe(false);
      expect(result.mine).toBe(true);
      expect(reviews.save).toHaveBeenCalled();
      expect(reviews.findByDeviceAndSchool).not.toHaveBeenCalled();
    });

    it('creates an anonymous review when the logged-in user asks for it', async () => {
      const result = await useCase.execute({
        schoolId,
        rating: 4,
        anonymous: true,
        userId,
      });
      expect(result.created).toBe(true);
      expect(result.isAnonymous).toBe(true);
      expect(result.author).toBeNull();
    });

    it('creates an anonymous review from x-device-id without login', async () => {
      const result = await useCase.execute({
        schoolId,
        rating: 3,
        comment: 'Ok',
        deviceId,
      });
      expect(result.created).toBe(true);
      expect(result.isAnonymous).toBe(true);
      expect(reviews.findByDeviceAndSchool).toHaveBeenCalledWith(
        deviceId,
        schoolId,
      );
      const saved = reviews.save.mock.calls[0][0] as Review;
      expect(saved.userId).toBeNull();
      expect(saved.deviceId).toBe(deviceId);
    });

    it('updates the existing review (upsert)', async () => {
      const existing = Review.create({
        id: 'rev-1',
        userId,
        schoolId,
        rating: 2,
        comment: 'Antigo',
      }).review;
      reviews.findByUserAndSchool.mockResolvedValue(existing);

      const result = await useCase.execute({
        schoolId,
        rating: 5,
        comment: 'Melhorou',
        userId,
      });
      expect(result.created).toBe(false);
      expect(result.rating).toBe(5);
      expect(result.comment).toBe('Melhorou');
    });

    it('rejects missing identity', async () => {
      await expect(
        useCase.execute({ schoolId, rating: 5 }),
      ).rejects.toBeInstanceOf(ReviewIdentityRequiredException);
    });

    it('rejects invalid rating', async () => {
      await expect(
        useCase.execute({ schoolId, rating: 6, userId }),
      ).rejects.toBeInstanceOf(InvalidReviewRatingException);
    });

    it('rejects missing school', async () => {
      prisma.school.findUnique.mockResolvedValue(null);
      await expect(
        useCase.execute({ schoolId, rating: 4, userId }),
      ).rejects.toBeInstanceOf(ReviewSchoolNotFoundException);
    });

    it('rejects non-ACTIVE school', async () => {
      prisma.school.findUnique.mockResolvedValue({
        id: schoolId,
        status: SchoolStatus.DRAFT,
      });
      await expect(
        useCase.execute({ schoolId, rating: 4, userId }),
      ).rejects.toBeInstanceOf(ReviewSchoolNotEligibleException);
    });
  });

  describe('ListSchoolReviewsUseCase', () => {
    it('hides the author when the review is anonymous and marks mine', async () => {
      const rows = [
        {
          id: 'rev-anon',
          userId,
          deviceId: null,
          schoolId,
          rating: 5,
          comment: 'Segredo',
          isAnonymous: true,
          isPublished: true,
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
          updatedAt: new Date('2026-08-01T00:00:00.000Z'),
          user: { id: userId, firstName: 'Ana', lastName: 'Silva' },
        },
        {
          id: 'rev-named',
          userId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          deviceId: null,
          schoolId,
          rating: 4,
          comment: 'Bom',
          isAnonymous: false,
          isPublished: true,
          createdAt: new Date('2026-08-02T00:00:00.000Z'),
          updatedAt: new Date('2026-08-02T00:00:00.000Z'),
          user: {
            id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            firstName: 'João',
            lastName: 'Costa',
          },
        },
      ];
      const prisma = {
        school: { findUnique: jest.fn().mockResolvedValue({ id: schoolId }) },
        review: {
          count: jest.fn().mockResolvedValue(2),
          findMany: jest.fn().mockResolvedValue(rows),
          aggregate: jest.fn().mockResolvedValue({
            _avg: { rating: 4.5 },
            _count: { rating: 2 },
          }),
        },
        $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      };
      const useCase = new ListSchoolReviewsUseCase(prisma as never);
      const result = (await useCase.execute({ schoolId, userId })) as {
        summary: { average: number; count: number };
        items: Array<{
          id: string;
          author: { name: string } | null;
          mine: boolean;
        }>;
      };

      expect(result.summary).toEqual({ average: 4.5, count: 2 });
      expect(result.items[0]).toMatchObject({
        id: 'rev-anon',
        author: null,
        mine: true,
      });
      expect(result.items[1]).toMatchObject({
        id: 'rev-named',
        author: { name: 'João Costa' },
        mine: false,
      });
    });

    it('rejects missing school', async () => {
      const prisma = {
        school: { findUnique: jest.fn().mockResolvedValue(null) },
        $transaction: jest.fn(),
      };
      const useCase = new ListSchoolReviewsUseCase(prisma as never);
      await expect(useCase.execute({ schoolId })).rejects.toBeInstanceOf(
        ReviewSchoolNotFoundException,
      );
    });
  });

  describe('DeleteReviewUseCase', () => {
    it('deletes own review', async () => {
      const review = Review.create({
        id: 'rev-1',
        userId,
        schoolId,
        rating: 4,
      }).review;
      const reviews = {
        findById: jest.fn().mockResolvedValue(review),
        delete: jest.fn().mockResolvedValue(undefined),
      };
      const useCase = new DeleteReviewUseCase(reviews as never);
      await expect(
        useCase.execute({ reviewId: 'rev-1', userId }),
      ).resolves.toEqual({ removed: true });
      expect(reviews.delete).toHaveBeenCalledWith('rev-1');
    });

    it('deletes anonymous review by device', async () => {
      const review = Review.create({
        id: 'rev-2',
        deviceId,
        schoolId,
        rating: 3,
        isAnonymous: true,
      }).review;
      const reviews = {
        findById: jest.fn().mockResolvedValue(review),
        delete: jest.fn().mockResolvedValue(undefined),
      };
      const useCase = new DeleteReviewUseCase(reviews as never);
      await expect(
        useCase.execute({ reviewId: 'rev-2', deviceId }),
      ).resolves.toEqual({ removed: true });
    });

    it('forbids deleting someone else review', async () => {
      const review = Review.create({
        id: 'rev-1',
        userId,
        schoolId,
        rating: 4,
      }).review;
      const reviews = {
        findById: jest.fn().mockResolvedValue(review),
        delete: jest.fn(),
      };
      const useCase = new DeleteReviewUseCase(reviews as never);
      await expect(
        useCase.execute({
          reviewId: 'rev-1',
          userId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        }),
      ).rejects.toBeInstanceOf(ForbiddenDomainException);
      expect(reviews.delete).not.toHaveBeenCalled();
    });

    it('rejects missing review', async () => {
      const reviews = {
        findById: jest.fn().mockResolvedValue(null),
        delete: jest.fn(),
      };
      const useCase = new DeleteReviewUseCase(reviews as never);
      await expect(
        useCase.execute({ reviewId: 'rev-x', userId }),
      ).rejects.toBeInstanceOf(ReviewNotFoundException);
    });
  });
});
