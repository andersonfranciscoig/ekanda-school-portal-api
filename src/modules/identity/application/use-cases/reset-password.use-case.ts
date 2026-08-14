import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/domain.exception';
import { MailService } from '../../../mail/application/mail.service';
import { EmailChallengeService } from '../../../mail/application/email-challenge.service';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../domain/repositories/user.repository';
import { PasswordHasher } from '../ports/password-hasher.port';
import { PASSWORD_HASHER } from './register-user.use-case';

export type ResetPasswordInput = {
  email: string;
  token: string;
  password: string;
};

export type ResetPasswordOutput = {
  reset: true;
};

@Injectable()
export class ResetPasswordUseCase
  implements UseCase<ResetPasswordInput, ResetPasswordOutput>
{
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    private readonly challenges: EmailChallengeService,
    private readonly mail: MailService,
  ) {}

  async execute(input: ResetPasswordInput): Promise<ResetPasswordOutput> {
    const payload = await this.challenges.consumePasswordResetChallenge(
      input.email,
      input.token,
    );

    const user = await this.users.findById(payload.userId);
    if (!user) throw new EntityNotFoundException('User not found');

    const passwordHash = await this.passwordHasher.hash(input.password);
    user.updatePassword(passwordHash);
    await this.users.save(user);

    this.mail.sendPasswordChanged({
      email: user.email.value,
      firstName: user.firstName,
    });

    return { reset: true };
  }
}
