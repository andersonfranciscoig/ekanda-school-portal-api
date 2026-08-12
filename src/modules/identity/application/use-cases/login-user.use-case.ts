import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { UnauthorizedDomainException } from '../../../../shared/domain/exceptions/domain.exception';
import { Email } from '../../../../shared/domain/value-objects/email.vo';
import { User } from '../../domain/entities/user.entity';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../domain/repositories/user.repository';
import { PasswordHasher } from '../ports/password-hasher.port';
import { TokenIssuer } from '../ports/token-issuer.port';
import { PASSWORD_HASHER, TOKEN_ISSUER } from './register-user.use-case';

export type LoginUserInput = {
  email: string;
  password: string;
};

export type LoginUserOutput = {
  accessToken: string;
  refreshToken: string;
  user: ReturnType<User['toPublic']>;
};

@Injectable()
export class LoginUserUseCase
  implements UseCase<LoginUserInput, LoginUserOutput>
{
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(TOKEN_ISSUER) private readonly tokenIssuer: TokenIssuer,
  ) {}

  async execute(input: LoginUserInput): Promise<LoginUserOutput> {
    const email = Email.create(input.email);
    const user = await this.users.findByEmail(email.value);

    if (!user) {
      throw new UnauthorizedDomainException('invalid credentials');
    }

    user.assertCanAuthenticate();

    const ok = await this.passwordHasher.compare(
      input.password,
      user.passwordHash,
    );
    if (!ok) {
      throw new UnauthorizedDomainException('invalid credentials');
    }

    const { accessToken, refreshToken } = await this.tokenIssuer.issuePair({
      sub: user.id,
      email: user.email.value,
      role: user.role,
    });

    return { accessToken, refreshToken, user: user.toPublic() };
  }
}
