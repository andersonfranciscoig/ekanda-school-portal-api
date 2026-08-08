import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  ConflictDomainException,
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

export type RegisterUserInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  role?: UserRole;
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
      role: input.role,
    });

    const saved = await this.users.save(user);
    const accessToken = await this.tokenIssuer.issue({
      sub: saved.id,
      email: saved.email.value,
      role: saved.role,
    });

    return { accessToken, user: saved.toPublic() };
  }
}
