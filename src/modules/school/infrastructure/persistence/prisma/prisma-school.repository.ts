import { Injectable } from '@nestjs/common';
import {
  MembershipStatus,
  SchoolMembershipRole as PrismaMembershipRole,
  SchoolStatus as PrismaSchoolStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { School } from '../../../domain/aggregates/school.aggregate';
import {
  SchoolMembershipView,
  SchoolRepository,
} from '../../../domain/repositories/school.repository';
import { SchoolMembershipRole } from '../../../domain/school.enums';
import { SchoolMapper } from '../mappers/school.mapper';

const schoolInclude = {
  location: true,
  classes: true,
  services: true,
  prices: true,
  gallery: true,
} as const;

@Injectable()
export class PrismaSchoolRepository implements SchoolRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(school: School): Promise<void> {
    const data = SchoolMapper.toPersistence(school);
    await this.prisma.school.update({
      where: { id: school.id },
      data: {
        name: data.name,
        description: data.description,
        status: data.status as PrismaSchoolStatus,
        phone: data.phone,
        email: data.email,
        website: data.website,
        logoUrl: data.logoUrl,
        coverImageUrl: data.coverImageUrl,
        foundedAt: data.foundedAt,
      },
    });
  }

  async findById(id: string): Promise<School | null> {
    const record = await this.prisma.school.findUnique({
      where: { id },
      include: schoolInclude,
    });
    return record ? SchoolMapper.toDomain(record) : null;
  }

  async findBySlug(slug: string): Promise<School | null> {
    const record = await this.prisma.school.findUnique({
      where: { slug },
      include: schoolInclude,
    });
    return record ? SchoolMapper.toDomain(record) : null;
  }

  async existsBySlug(slug: string): Promise<boolean> {
    const count = await this.prisma.school.count({ where: { slug } });
    return count > 0;
  }

  async findActiveMembership(
    schoolId: string,
    userId: string,
  ): Promise<SchoolMembershipView | null> {
    const membership = await this.prisma.schoolMembership.findUnique({
      where: { userId_schoolId: { userId, schoolId } },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      return null;
    }
    return {
      userId: membership.userId,
      schoolId: membership.schoolId,
      role: membership.role as SchoolMembershipRole,
      status: membership.status,
    };
  }

  async listByMemberUserId(userId: string): Promise<School[]> {
    const memberships = await this.prisma.schoolMembership.findMany({
      where: { userId, status: MembershipStatus.ACTIVE },
      include: { school: { include: schoolInclude } },
      orderBy: { createdAt: 'desc' },
    });
    return memberships.map((m) => SchoolMapper.toDomain(m.school));
  }

  async createWithOwner(params: {
    school: School;
    ownerUserId: string;
  }): Promise<School> {
    const { school, ownerUserId } = params;
    const persistence = SchoolMapper.toPersistence(school);

    const created = await this.prisma.$transaction(
      async (tx) => {
        const record = await tx.school.create({
          data: {
            id: persistence.id,
            name: persistence.name,
            slug: persistence.slug,
            description: persistence.description,
            status: PrismaSchoolStatus.DRAFT,
            phone: persistence.phone,
            email: persistence.email,
            website: persistence.website,
            logoUrl: persistence.logoUrl,
            coverImageUrl: persistence.coverImageUrl,
            foundedAt: persistence.foundedAt,
            memberships: {
              create: {
                userId: ownerUserId,
                role: PrismaMembershipRole.OWNER,
                status: MembershipStatus.ACTIVE,
              },
            },
            ...(school.location
              ? {
                  location: {
                    create: {
                      id: school.location.id,
                      province: school.location.address.province,
                      municipality: school.location.address.municipality,
                      district: school.location.address.district,
                      neighborhood: school.location.address.neighborhood,
                      address: school.location.address.street,
                      latitude: school.location.coordinates?.latitude,
                      longitude: school.location.coordinates?.longitude,
                    },
                  },
                }
              : {}),
          },
          include: schoolInclude,
        });

        await tx.user.update({
          where: { id: ownerUserId },
          data: { role: UserRole.SCHOOL_OWNER },
        });

        return record;
      },
      { maxWait: 10000, timeout: 20000 },
    );

    return SchoolMapper.toDomain(created);
  }
}
