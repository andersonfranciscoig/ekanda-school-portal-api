import { Injectable } from '@nestjs/common';
import { UserRole as PrismaUserRole } from '@prisma/client';
import { PrismaService } from '../../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { Email } from '../../../../../shared/domain/value-objects/email.vo';
import { Phone } from '../../../../../shared/domain/value-objects/phone.vo';
import { User, UserRole } from '../../../domain/entities/user.entity';
import { UserRepository } from '../../../domain/repositories/user.repository';

type UserRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  isActive: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  platformRoles: Array<{ role: PrismaUserRole }>;
};

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(user: User): Promise<User> {
    const role = user.role as PrismaUserRole;

    const record = await this.prisma.$transaction(async (tx) => {
      await tx.user.upsert({
        where: { id: user.id },
        create: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email.value,
          phone: user.phone?.value ?? null,
          passwordHash: user.passwordHash,
          isActive: user.isActive,
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
          platformRoles: {
            create: {
              id: crypto.randomUUID(),
              role,
            },
          },
        },
        update: {
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone?.value ?? null,
          passwordHash: user.passwordHash,
          isActive: user.isActive,
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
        },
      });

      await tx.userPlatformRole.upsert({
        where: {
          userId_role: { userId: user.id, role },
        },
        create: {
          id: crypto.randomUUID(),
          userId: user.id,
          role,
        },
        update: {},
      });

      return tx.user.findUniqueOrThrow({
        where: { id: user.id },
        include: { platformRoles: true },
      });
    });

    return this.toDomain(record);
  }

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({
      where: { id },
      include: { platformRoles: true },
    });
    return record ? this.toDomain(record) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { platformRoles: true },
    });
    return record ? this.toDomain(record) : null;
  }

  async findByPhone(phone: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({
      where: { phone },
      include: { platformRoles: true },
    });
    return record ? this.toDomain(record) : null;
  }

  private primaryRole(roles: Array<{ role: PrismaUserRole }>): UserRole {
    const list = roles.map((r) => r.role);
    if (list.includes(PrismaUserRole.EKANDA_ADMIN)) return UserRole.EKANDA_ADMIN;
    if (list.includes(PrismaUserRole.SCHOOL_OWNER)) return UserRole.SCHOOL_OWNER;
    if (list.includes(PrismaUserRole.SCHOOL_ADMIN)) return UserRole.SCHOOL_ADMIN;
    if (list.includes(PrismaUserRole.GUARDIAN)) return UserRole.GUARDIAN;
    return UserRole.GUARDIAN;
  }

  private toDomain(record: UserRecord): User {
    return User.rehydrate({
      id: record.id,
      firstName: record.firstName,
      lastName: record.lastName,
      email: Email.create(record.email),
      phone: record.phone ? Phone.create(record.phone) : null,
      passwordHash: record.passwordHash,
      role: this.primaryRole(record.platformRoles),
      isActive: record.isActive,
      emailVerified: record.emailVerified,
      phoneVerified: record.phoneVerified,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
