import { Injectable } from '@nestjs/common';
import { UserRole as PrismaUserRole } from '@prisma/client';
import { PrismaService } from '../../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { Email } from '../../../../../shared/domain/value-objects/email.vo';
import { Phone } from '../../../../../shared/domain/value-objects/phone.vo';
import { User, UserRole } from '../../../domain/entities/user.entity';
import { UserRepository } from '../../../domain/repositories/user.repository';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(user: User): Promise<User> {
    const record = await this.prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email.value,
        phone: user.phone?.value ?? null,
        passwordHash: user.passwordHash,
        role: user.role as PrismaUserRole,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
      },
      update: {
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone?.value ?? null,
        passwordHash: user.passwordHash,
        role: user.role as PrismaUserRole,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
      },
    });
    return this.toDomain(record);
  }

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    return record ? this.toDomain(record) : null;
  }

  async findByPhone(phone: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { phone } });
    return record ? this.toDomain(record) : null;
  }

  private toDomain(record: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    passwordHash: string;
    role: string;
    isActive: boolean;
    emailVerified: boolean;
    phoneVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return User.rehydrate({
      id: record.id,
      firstName: record.firstName,
      lastName: record.lastName,
      email: Email.create(record.email),
      phone: record.phone ? Phone.create(record.phone) : null,
      passwordHash: record.passwordHash,
      role: record.role as UserRole,
      isActive: record.isActive,
      emailVerified: record.emailVerified,
      phoneVerified: record.phoneVerified,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
