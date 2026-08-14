import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  ConflictDomainException,
  ForbiddenDomainException,
  UnauthorizedDomainException,
} from '../../../../shared/domain/exceptions/domain.exception';
import { Email } from '../../../../shared/domain/value-objects/email.vo';
import { Phone } from '../../../../shared/domain/value-objects/phone.vo';
import { PlatformBetaService } from '../../../platform-beta/application/platform-beta.service';
import { MailService } from '../../../mail/application/mail.service';
import { EmailChallengeService } from '../../../mail/application/email-challenge.service';
import { UserRole } from '../../domain/entities/user.entity';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../domain/repositories/user.repository';
import { PasswordHasher } from '../ports/password-hasher.port';
import { PASSWORD_HASHER } from './register-user.use-case';

const PUBLIC_REGISTER_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.GUARDIAN,
  UserRole.SCHOOL_OWNER,
]);

export type StartRegisterInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  role?: UserRole;
  actorRole?: UserRole;
};

export type StartRegisterOutput = {
  sent: true;
  expiresInSec: number;
  email: string;
};

@Injectable()
export class StartRegisterUseCase
  implements UseCase<StartRegisterInput, StartRegisterOutput>
{
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    private readonly platformBeta: PlatformBetaService,
    private readonly challenges: EmailChallengeService,
    private readonly mail: MailService,
  ) {}

  async execute(input: StartRegisterInput): Promise<StartRegisterOutput> {
    const role = input.role ?? UserRole.GUARDIAN;
    this.assertCanAssignRole(role, input.actorRole);

    const email = Email.create(input.email);
    if (await this.users.findByEmail(email.value)) {
      throw new ConflictDomainException('exists a user with this email');
    }

    const phone = input.phone ? Phone.create(input.phone) : null;
    if (phone && (await this.users.findByPhone(phone.value))) {
      throw new ConflictDomainException('exists a user with this phone');
    }

    await this.platformBeta.assertCanRegister(email.value, role);

    const passwordHash = await this.passwordHasher.hash(input.password);
    const { code, expiresInSec } =
      await this.challenges.issueRegisterChallenge(email.value, {
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        phone: phone?.value,
        passwordHash,
        role,
      });

    this.mail.sendRegisterOtp({
      email: email.value,
      firstName: input.firstName.trim(),
      otp: code,
    });

    return { sent: true, expiresInSec, email: email.value };
  }

  private assertCanAssignRole(role: UserRole, actorRole?: UserRole): void {
    if (PUBLIC_REGISTER_ROLES.has(role)) return;
    if (!actorRole || actorRole !== UserRole.EKANDA_ADMIN) {
      throw actorRole
        ? new ForbiddenDomainException('Only EKANDA_ADMIN can assign this role')
        : new UnauthorizedException('Authentication required');
    }
  }
}
