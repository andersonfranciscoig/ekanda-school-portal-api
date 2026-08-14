import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailChallengePurpose } from '@prisma/client';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../../../shared/infrastructure/persistence/prisma/prisma.service';

const OTP_TTL_MS = 10 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

export type RegisterChallengePayload = {
  firstName: string;
  lastName: string;
  phone?: string;
  passwordHash: string;
  role: string;
};

export type PasswordResetPayload = {
  userId: string;
  firstName: string;
};

@Injectable()
export class EmailChallengeService {
  private readonly pepper: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.pepper =
      config.get<string>('EMAIL_OTP_SECRET') ??
      config.getOrThrow<string>('JWT_SECRET');
  }

  private hashCode(code: string): string {
    return createHash('sha256')
      .update(`${code}:${this.pepper}`)
      .digest('hex');
  }

  private generateOtp(): string {
    return String(randomInt(100000, 1000000));
  }

  private generateResetToken(): string {
    return crypto.randomUUID().replace(/-/g, '');
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async issueRegisterChallenge(
    email: string,
    payload: RegisterChallengePayload,
  ): Promise<{ code: string; expiresInSec: number }> {
    const normalized = this.normalizeEmail(email);
    await this.assertResendCooldown(normalized, EmailChallengePurpose.REGISTER);

    const code = this.generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.prisma.emailChallenge.deleteMany({
      where: { email: normalized, purpose: EmailChallengePurpose.REGISTER },
    });

    await this.prisma.emailChallenge.create({
      data: {
        id: crypto.randomUUID(),
        email: normalized,
        purpose: EmailChallengePurpose.REGISTER,
        codeHash: this.hashCode(code),
        payloadJson: payload,
        expiresAt,
      },
    });

    return { code, expiresInSec: OTP_TTL_MS / 1000 };
  }

  async consumeRegisterChallenge(
    email: string,
    code: string,
  ): Promise<RegisterChallengePayload> {
    const normalized = this.normalizeEmail(email);
    const challenge = await this.prisma.emailChallenge.findFirst({
      where: {
        email: normalized,
        purpose: EmailChallengePurpose.REGISTER,
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      throw new BadRequestException('Código inválido ou expirado.');
    }
    if (challenge.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Código expirado. Peça um novo código.');
    }
    if (challenge.attempts >= MAX_ATTEMPTS) {
      throw new HttpException(
        'Demasiadas tentativas. Peça um novo código.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const ok = challenge.codeHash === this.hashCode(code.trim());
    if (!ok) {
      await this.prisma.emailChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Código incorrecto.');
    }

    await this.prisma.emailChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    return challenge.payloadJson as RegisterChallengePayload;
  }

  async issuePasswordResetChallenge(
    email: string,
    payload: PasswordResetPayload,
  ): Promise<{ token: string; expiresInSec: number }> {
    const normalized = this.normalizeEmail(email);
    await this.assertResendCooldown(
      normalized,
      EmailChallengePurpose.PASSWORD_RESET,
    );

    const token = this.generateResetToken();
    const expiresAt = new Date(Date.now() + RESET_TTL_MS);

    await this.prisma.emailChallenge.deleteMany({
      where: {
        email: normalized,
        purpose: EmailChallengePurpose.PASSWORD_RESET,
      },
    });

    await this.prisma.emailChallenge.create({
      data: {
        id: crypto.randomUUID(),
        email: normalized,
        purpose: EmailChallengePurpose.PASSWORD_RESET,
        codeHash: this.hashCode(token),
        payloadJson: payload,
        expiresAt,
      },
    });

    return { token, expiresInSec: RESET_TTL_MS / 1000 };
  }

  async consumePasswordResetChallenge(
    email: string,
    token: string,
  ): Promise<PasswordResetPayload> {
    const normalized = this.normalizeEmail(email);
    const challenge = await this.prisma.emailChallenge.findFirst({
      where: {
        email: normalized,
        purpose: EmailChallengePurpose.PASSWORD_RESET,
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge || challenge.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Link inválido ou expirado.');
    }
    if (challenge.codeHash !== this.hashCode(token.trim())) {
      throw new BadRequestException('Link inválido ou expirado.');
    }

    await this.prisma.emailChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    return challenge.payloadJson as PasswordResetPayload;
  }

  private async assertResendCooldown(
    email: string,
    purpose: EmailChallengePurpose,
  ) {
    const recent = await this.prisma.emailChallenge.findFirst({
      where: { email, purpose },
      orderBy: { createdAt: 'desc' },
    });
    if (
      recent &&
      Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS
    ) {
      throw new HttpException(
        'Aguarde um minuto antes de pedir outro código.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
