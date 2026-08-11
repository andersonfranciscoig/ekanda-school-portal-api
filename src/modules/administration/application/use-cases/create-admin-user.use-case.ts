import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  BusinessRuleViolationException,
  ConflictDomainException,
} from '../../../../shared/domain/exceptions/domain.exception';
import { Email } from '../../../../shared/domain/value-objects/email.vo';
import { Phone } from '../../../../shared/domain/value-objects/phone.vo';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { User, UserRole } from '../../../identity/domain/entities/user.entity';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../../identity/domain/repositories/user.repository';
import { PasswordHasher } from '../../../identity/application/ports/password-hasher.port';
import { PASSWORD_HASHER } from '../../../identity/application/use-cases/register-user.use-case';
import { presentAdminUser } from '../services/admin.presenter';

const ALLOWED_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.EKANDA_ADMIN,
  UserRole.SCHOOL_ADMIN,
]);

export type CreateAdminUserInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  role: UserRole;
};

@Injectable()
export class CreateAdminUserUseCase
  implements UseCase<CreateAdminUserInput, unknown>
{
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: CreateAdminUserInput) {
    if (!ALLOWED_ROLES.has(input.role)) {
      throw new BusinessRuleViolationException(
        'Only EKANDA_ADMIN or SCHOOL_ADMIN can be created here',
      );
    }

    const email = Email.create(input.email);
    if (await this.users.findByEmail(email.value)) {
      throw new ConflictDomainException('exists a user with this email');
    }

    const phone = input.phone ? Phone.create(input.phone) : null;
    if (phone && (await this.users.findByPhone(phone.value))) {
      throw new ConflictDomainException('exists a user with this phone');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = User.create({
      id: crypto.randomUUID(),
      firstName: input.firstName,
      lastName: input.lastName,
      email,
      phone,
      passwordHash,
      role: input.role,
    });
    const saved = await this.users.save(user);

    const row = await this.prisma.user.findUniqueOrThrow({
      where: { id: saved.id },
      include: { platformRoles: { select: { role: true } } },
    });
    return presentAdminUser(row);
  }
}
