import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { Review, ReviewRepository } from '../../../domain/marketplace.domain';

@Injectable()
export class PrismaReviewRepository implements ReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(review: Review): Promise<void> {
    await this.prisma.review.upsert({
      where: { id: review.id },
      create: {
        id: review.id,
        userId: review.userId,
        deviceId: review.deviceId,
        schoolId: review.schoolId,
        rating: review.rating,
        comment: review.comment,
        isAnonymous: review.isAnonymous,
        isPublished: review.isPublished,
      },
      update: {
        rating: review.rating,
        comment: review.comment,
        isAnonymous: review.isAnonymous,
        isPublished: review.isPublished,
      },
    });
  }

  async findById(id: string): Promise<Review | null> {
    const record = await this.prisma.review.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findByUserAndSchool(
    userId: string,
    schoolId: string,
  ): Promise<Review | null> {
    const record = await this.prisma.review.findFirst({
      where: { userId, schoolId },
    });
    return record ? this.toDomain(record) : null;
  }

  async findByDeviceAndSchool(
    deviceId: string,
    schoolId: string,
  ): Promise<Review | null> {
    const record = await this.prisma.review.findFirst({
      where: { deviceId, schoolId },
    });
    return record ? this.toDomain(record) : null;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.review.delete({ where: { id } });
  }

  private toDomain(record: {
    id: string;
    userId: string | null;
    deviceId: string | null;
    schoolId: string;
    rating: number;
    comment: string | null;
    isAnonymous: boolean;
    isPublished: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Review {
    return Review.rehydrate(record);
  }
}
