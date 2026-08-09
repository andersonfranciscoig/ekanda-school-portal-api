import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  ConflictDomainException,
  ForbiddenDomainException,
  UnauthorizedDomainException,
} from '../../../../shared/domain/exceptions/domain.exception';
import { Email } from '../../../../shared/domain/value-objects/email.vo';
import { Phone } from '../../../../shared/domain/value-objects/phone.vo';
import { User, UserRole } from '../../domain/entities/user.entity';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../domain/repositories/user.repository';
import { PasswordHasher } from '../ports/password-hasher.port';
import { TokenIssuer } from '../ports/token-issuer.port';

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
export const TOKEN_ISSUER = Symbol('TOKEN_ISSUER');

/** Roles that anyone can self-register without authentication. */
const PUBLIC_REGISTER_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.GUARDIAN,
  UserRole.SCHOOL_OWNER,
]);

export type RegisterUserInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  role?: UserRole;
  /** Present when Authorization Bearer was sent (optional JWT). */
  actorUserId?: string;
  actorRole?: UserRole;
};

export type RegisterUserOutput = {
  accessToken: string;
  user: ReturnType<User['toPublic']>;
};

@Injectable()
export class RegisterUserUseCase
  implements UseCase<RegisterUserInput, RegisterUserOutput>
{
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(TOKEN_ISSUER) private readonly tokenIssuer: TokenIssuer,
  ) {}

  async execute(input: RegisterUserInput): Promise<RegisterUserOutput> {
    const role = input.role ?? UserRole.GUARDIAN;
    this.assertCanAssignRole(role, input.actorRole);

    const email = Email.create(input.email);
    if (await this.users.findByEmail(email.value)) {
      throw new ConflictDomainException('exists a user with this email');
    }

    const phone = input.phone ? Phone.create(input.phone) : null;
    if (phone && (await this.users.findByPhone(phone.value))) {
      throw new ConflictDomainException(
        'exists a user with this phone',
      );
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = User.create({
      id: crypto.randomUUID(),
      firstName: input.firstName,
      lastName: input.lastName,
      email,
      phone,
      passwordHash,
      role,
    });

    const saved = await this.users.save(user);
    const accessToken = await this.tokenIssuer.issue({
      sub: saved.id,
      email: saved.email.value,
      role: saved.role,
    });

    return { accessToken, user: saved.toPublic() };
  }

  private assertCanAssignRole(
    role: UserRole,
    actorRole?: UserRole,
  ): void {
    if (PUBLIC_REGISTER_ROLES.has(role)) {
      return;
    }

    if (role === UserRole.EKANDA_ADMIN) {
      if (!actorRole) {
        throw new UnauthorizedDomainException(
          'Authentication required to create EKANDA ADMIN',
        );
      }
      if (actorRole !== UserRole.EKANDA_ADMIN) {
        throw new ForbiddenDomainException(
          'Only EKANDA_ADMIN can create platform admins',
        );
      }
      return;
    }

    // SCHOOL_ADMIN and any future privileged roles: only platform admin.
    if (!actorRole) {
      throw new UnauthorizedDomainException(
        `Authentication required to create role ${role}`,
      );
    }
    if (actorRole !== UserRole.EKANDA_ADMIN) {
      throw new ForbiddenDomainException(
        `Only EKANDA_ADMIN can assign role ${role}`,
      );
    }
  }
}
