import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Email } from '../../../../shared/domain/value-objects/email.vo';
import { Phone } from '../../../../shared/domain/value-objects/phone.vo';
import { MailService } from '../../../mail/application/mail.service';
import { EmailChallengeService } from '../../../mail/application/email-challenge.service';
import { User, UserRole } from '../../domain/entities/user.entity';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../domain/repositories/user.repository';
import { TokenIssuer } from '../ports/token-issuer.port';
import { TOKEN_ISSUER } from './register-user.use-case';

export type ConfirmRegisterInput = {
  email: string;
  otp: string;
};

export type ConfirmRegisterOutput = {
  accessToken: string;
  refreshToken: string;
  user: ReturnType<User['toPublic']>;
};

@Injectable()
export class ConfirmRegisterUseCase
  implements UseCase<ConfirmRegisterInput, ConfirmRegisterOutput>
{
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(TOKEN_ISSUER) private readonly tokenIssuer: TokenIssuer,
    private readonly challenges: EmailChallengeService,
    private readonly mail: MailService,
  ) {}

  async execute(input: ConfirmRegisterInput): Promise<ConfirmRegisterOutput> {
    const payload = await this.challenges.consumeRegisterChallenge(
      input.email,
      input.otp,
    );

    const email = Email.create(input.email);
    const phone = payload.phone ? Phone.create(payload.phone) : null;
    const role = payload.role as UserRole;

    const user = User.createVerified({
      id: crypto.randomUUID(),
      firstName: payload.firstName,
      lastName: payload.lastName,
      email,
      phone,
      passwordHash: payload.passwordHash,
      role,
    });

    const saved = await this.users.save(user);
    const { accessToken, refreshToken } = await this.tokenIssuer.issuePair({
      sub: saved.id,
      email: saved.email.value,
      role: saved.role,
    });

    if (role === UserRole.GUARDIAN) {
      this.mail.sendWelcomeGuardian({
        email: saved.email.value,
        firstName: saved.firstName,
      });
    } else if (role === UserRole.SCHOOL_OWNER) {
      this.mail.sendWelcomeSchoolOwner({
        email: saved.email.value,
        firstName: saved.firstName,
      });
    }

    return { accessToken, refreshToken, user: saved.toPublic() };
  }
}
