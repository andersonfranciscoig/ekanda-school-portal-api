import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MembershipStatus,
  Prisma,
  SchoolMembershipRole,
  SchoolStatus,
} from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';

const schoolPublicInclude = {
  location: true,
  classes: { where: { isActive: true }, orderBy: { name: 'asc' as const } },
  services: { where: { isActive: true }, orderBy: { name: 'asc' as const } },
  prices: { where: { isActive: true }, orderBy: { name: 'asc' as const } },
  gallery: { orderBy: { sortOrder: 'asc' as const } },
} satisfies Prisma.SchoolInclude;

/**
 * Read models HTTP — consultas de apresentação (não regras de domínio).
 * Mantém o contrato de resposta existente.
 */
@Injectable()
export class SchoolHttpQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async findMine(userId: string) {
    const memberships = await this.prisma.schoolMembership.findMany({
      where: { userId, status: MembershipStatus.ACTIVE },
      include: { school: { include: { location: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return memberships.map((m) => ({
      membership: { id: m.id, role: m.role, status: m.status },
      school: m.school,
    }));
  }

  async findPublicBySlug(slug: string) {
    const school = await this.prisma.school.findFirst({
      where: { slug: slug.toLowerCase(), status: SchoolStatus.ACTIVE },
      include: schoolPublicInclude,
    });
    if (!school) throw new NotFoundException('Colégio não encontrado');
    return school;
  }

  async findOneForMember(schoolId: string, userId: string) {
    await this.assertMembership(schoolId, userId);
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      include: {
        ...schoolPublicInclude,
        memberships: {
          where: { status: MembershipStatus.ACTIVE },
          select: {
            id: true,
            role: true,
            status: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });
    if (!school) throw new NotFoundException('Colégio não encontrado');
    return school;
  }

  async findCreatedDetail(schoolId: string, ownerUserId: string) {
    return this.prisma.school.findUnique({
      where: { id: schoolId },
      include: {
        location: true,
        memberships: {
          where: { userId: ownerUserId },
          select: { id: true, role: true, status: true },
        },
      },
    });
  }

  async updateProfile(
    schoolId: string,
    userId: string,
    data: {
      name?: string;
      description?: string;
      phone?: string;
      email?: string;
      website?: string;
      logoUrl?: string;
      coverImageUrl?: string;
    },
  ) {
    await this.assertMembership(schoolId, userId, [
      SchoolMembershipRole.OWNER,
      SchoolMembershipRole.ADMIN,
    ]);

    return this.prisma.school.update({
      where: { id: schoolId },
      data: {
        name: data.name?.trim(),
        description: data.description?.trim(),
        phone: data.phone?.trim(),
        email: data.email?.trim().toLowerCase(),
        website: data.website?.trim(),
        logoUrl: data.logoUrl?.trim(),
        coverImageUrl: data.coverImageUrl?.trim(),
      },
      include: { location: true },
    });
  }

  async assertMembership(
    schoolId: string,
    userId: string,
    roles?: SchoolMembershipRole[],
  ) {
    const membership = await this.prisma.schoolMembership.findUnique({
      where: { userId_schoolId: { userId, schoolId } },
    });

    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException(
        'Não tem acesso a este colégio. Isolamento multi-tenant aplicado.',
      );
    }

    if (roles?.length && !roles.includes(membership.role)) {
      throw new ForbiddenException('Permissão insuficiente neste colégio');
    }

    return membership;
  }
}
