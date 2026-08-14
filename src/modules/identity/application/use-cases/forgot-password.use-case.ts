import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { MailService } from '../../../mail/application/mail.service';
import { EmailChallengeService } from '../../../mail/application/email-challenge.service';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../domain/repositories/user.repository';

export type ForgotPasswordInput = {
  email: string;
};

export type ForgotPasswordOutput = {
  sent: true;
};

@Injectable()
export class ForgotPasswordUseCase
  implements UseCase<ForgotPasswordInput, ForgotPasswordOutput>
{
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly challenges: EmailChallengeService,
    private readonly mail: MailService,
  ) {}

  async execute(input: ForgotPasswordInput): Promise<ForgotPasswordOutput> {
    const email = input.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);

    // Resposta genérica — não revelar se o email existe
    if (!user) {
      return { sent: true };
    }

    const { token } = await this.challenges.issuePasswordResetChallenge(
      email,
      {
        userId: user.id,
        firstName: user.firstName,
      },
    );

    this.mail.sendPasswordReset({
      email,
      firstName: user.firstName,
      token,
    });

    return { sent: true };
  }
}
