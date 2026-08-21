import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BetaAccessStatus, BetaTesterType, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { UserRole } from '../../identity/domain/entities/user.entity';
import { PrismaService } from '../../../shared/infrastructure/persistence/prisma/prisma.service';
import { MailService } from '../../mail/application/mail.service';
import { firstNameFromEmail } from '../../mail/application/mail-recipients.service';

const SETTINGS_ID = 'default';
const SESSION_TTL_SEC = 14 * 24 * 60 * 60; // 14 days

export type BetaSlotsDto = {
  guardian: { limit: number; used: number; available: number };
  schoolOwner: { limit: number; used: number; available: number };
};

export type PlatformSettingsDto = {
  betaEnabled: boolean;
  whatsappCommunityUrl: string | null;
  betaLimitGuardian: number;
  betaLimitSchoolOwner: number;
  /** Validação automática de NIF via AGT (default false). */
  autoNifVerificationEnabled: boolean;
  /** True quando AGT_NIF_LOOKUP_BASE_URL está definida. */
  autoNifProviderConfigured: boolean;
  betaSlots: BetaSlotsDto;
  updatedAt: string;
};

export type BetaAccessRequestDto = {
  id: string;
  email: string;
  phone: string;
  testerType: BetaTesterType;
  status: BetaAccessStatus;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 9 && digits.startsWith('9')) return `244${digits}`;
  return digits;
}

function hashToken(jti: string): string {
  return createHash('sha256').update(jti).digest('hex');
}

function presentRequest(row: {
  id: string;
  email: string;
  phone: string;
  testerType: BetaTesterType;
  status: BetaAccessStatus;
  adminNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt: Date | null;
}): BetaAccessRequestDto {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    testerType: row.testerType,
    status: row.status,
    adminNote: row.adminNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}

function roleToTesterType(role: UserRole): BetaTesterType | null {
  if (role === UserRole.GUARDIAN) return BetaTesterType.GUARDIAN;
  if (role === UserRole.SCHOOL_OWNER) return BetaTesterType.SCHOOL_OWNER;
  return null;
}

function testerTypeLabel(type: BetaTesterType): string {
  return type === BetaTesterType.GUARDIAN ? 'encarregado' : 'colégio';
}

@Injectable()
export class PlatformBetaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async ensureSettings() {
    return this.prisma.platformSetting.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        betaEnabled: false,
        whatsappCommunityUrl: null,
        betaLimitGuardian: 50,
        betaLimitSchoolOwner: 20,
      },
      update: {},
    });
  }

  private async countUsedSlots(testerType: BetaTesterType): Promise<number> {
    return this.prisma.betaAccessRequest.count({
      where: {
        testerType,
        status: { in: [BetaAccessStatus.PENDING, BetaAccessStatus.APPROVED] },
      },
    });
  }

  private async buildSlots(row: {
    betaLimitGuardian: number;
    betaLimitSchoolOwner: number;
  }): Promise<BetaSlotsDto> {
    const [guardianUsed, schoolUsed] = await Promise.all([
      this.countUsedSlots(BetaTesterType.GUARDIAN),
      this.countUsedSlots(BetaTesterType.SCHOOL_OWNER),
    ]);
    return {
      guardian: {
        limit: row.betaLimitGuardian,
        used: guardianUsed,
        available: Math.max(0, row.betaLimitGuardian - guardianUsed),
      },
      schoolOwner: {
        limit: row.betaLimitSchoolOwner,
        used: schoolUsed,
        available: Math.max(0, row.betaLimitSchoolOwner - schoolUsed),
      },
    };
  }

  private async assertSlotAvailable(testerType: BetaTesterType) {
    const settings = await this.ensureSettings();
    const used = await this.countUsedSlots(testerType);
    const limit =
      testerType === BetaTesterType.GUARDIAN
        ? settings.betaLimitGuardian
        : settings.betaLimitSchoolOwner;

    if (used >= limit) {
      throw new ConflictException(
        `Atingimos o limite de vagas para testar como ${testerTypeLabel(testerType)}. Tente mais tarde ou escolha outra área.`,
      );
    }
  }

  private isAgtNifProviderConfigured(): boolean {
    return Boolean(this.config.get<string>('AGT_NIF_LOOKUP_BASE_URL')?.trim());
  }

  private async toSettingsDto(row: {
    betaEnabled: boolean;
    whatsappCommunityUrl: string | null;
    betaLimitGuardian: number;
    betaLimitSchoolOwner: number;
    autoNifVerificationEnabled: boolean;
    updatedAt: Date;
  }): Promise<PlatformSettingsDto> {
    return {
      betaEnabled: row.betaEnabled,
      whatsappCommunityUrl: row.whatsappCommunityUrl,
      betaLimitGuardian: row.betaLimitGuardian,
      betaLimitSchoolOwner: row.betaLimitSchoolOwner,
      autoNifVerificationEnabled: row.autoNifVerificationEnabled,
      autoNifProviderConfigured: this.isAgtNifProviderConfigured(),
      betaSlots: await this.buildSlots(row),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getSettings(): Promise<PlatformSettingsDto> {
    return this.toSettingsDto(await this.ensureSettings());
  }

  async updateSettings(input: {
    betaEnabled?: boolean;
    whatsappCommunityUrl?: string | null;
    betaLimitGuardian?: number;
    betaLimitSchoolOwner?: number;
    autoNifVerificationEnabled?: boolean;
  }): Promise<PlatformSettingsDto> {
    await this.ensureSettings();
    const row = await this.prisma.platformSetting.update({
      where: { id: SETTINGS_ID },
      data: {
        ...(input.betaEnabled !== undefined
          ? { betaEnabled: input.betaEnabled }
          : {}),
        ...(input.whatsappCommunityUrl !== undefined
          ? {
              whatsappCommunityUrl: input.whatsappCommunityUrl?.trim() || null,
            }
          : {}),
        ...(input.betaLimitGuardian !== undefined
          ? { betaLimitGuardian: Math.max(0, input.betaLimitGuardian) }
          : {}),
        ...(input.betaLimitSchoolOwner !== undefined
          ? { betaLimitSchoolOwner: Math.max(0, input.betaLimitSchoolOwner) }
          : {}),
        ...(input.autoNifVerificationEnabled !== undefined
          ? { autoNifVerificationEnabled: input.autoNifVerificationEnabled }
          : {}),
      },
    });
    return this.toSettingsDto(row);
  }

  async requestAccess(input: {
    email: string;
    phone: string;
    testerType: BetaTesterType;
  }): Promise<BetaAccessRequestDto> {
    const email = normalizeEmail(input.email);
    const phone = normalizePhone(input.phone);
    const testerType = input.testerType;

    if (!email || !email.includes('@')) {
      throw new BadRequestException('Email inválido.');
    }
    if (phone.length < 9) {
      throw new BadRequestException('Telefone inválido.');
    }
    if (
      testerType !== BetaTesterType.GUARDIAN &&
      testerType !== BetaTesterType.SCHOOL_OWNER
    ) {
      throw new BadRequestException('Tipo de teste inválido.');
    }

    const existing = await this.prisma.betaAccessRequest.findUnique({
      where: { email },
    });

    if (existing) {
      if (existing.status === 'APPROVED') {
        throw new ConflictException(
          'Este email já está aprovado. Use «Já faço parte da comunidade».',
        );
      }
      if (existing.status === 'PENDING') {
        if (existing.testerType !== testerType) {
          throw new ConflictException(
            `Este email já tem um pedido pendente como ${testerTypeLabel(existing.testerType)}.`,
          );
        }
        if (existing.phone !== phone) {
          const updated = await this.prisma.betaAccessRequest.update({
            where: { id: existing.id },
            data: { phone },
          });
          return presentRequest(updated);
        }
        return presentRequest(existing);
      }
      // REJECTED → reabrir como PENDING (verificar vaga)
      await this.assertSlotAvailable(testerType);
      const reopened = await this.prisma.betaAccessRequest.update({
        where: { id: existing.id },
        data: {
          phone,
          testerType,
          status: BetaAccessStatus.PENDING,
          adminNote: null,
          reviewedAt: null,
          sessionTokenHash: null,
          sessionExpiresAt: null,
        },
      });
      this.mail.sendBetaRequestReceived({
        email,
        firstName: firstNameFromEmail(email),
        testerTypeLabel: testerTypeLabel(testerType),
      });
      return presentRequest(reopened);
    }

    await this.assertSlotAvailable(testerType);

    const created = await this.prisma.betaAccessRequest.create({
      data: {
        id: randomUUID(),
        email,
        phone,
        testerType,
      },
    });
    this.mail.sendBetaRequestReceived({
      email,
      firstName: firstNameFromEmail(email),
      testerTypeLabel: testerTypeLabel(testerType),
    });
    return presentRequest(created);
  }

  async listRequests(params: {
    status?: BetaAccessStatus;
    q?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = params.page ?? 1;
    const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 20));
    const q = params.q?.trim().toLowerCase();

    const where: Prisma.BetaAccessRequestWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.betaAccessRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.betaAccessRequest.count({ where }),
    ]);

    return {
      items: items.map(presentRequest),
      total,
      page,
      pageSize,
    };
  }

  async reviewRequest(
    id: string,
    input: {
      status: 'APPROVED' | 'REJECTED';
      adminNote?: string;
    },
  ): Promise<BetaAccessRequestDto> {
    const current = await this.prisma.betaAccessRequest.findUnique({
      where: { id },
    });
    if (!current) throw new NotFoundException('Pedido não encontrado.');

    const updated = await this.prisma.betaAccessRequest.update({
      where: { id },
      data: {
        status: input.status as BetaAccessStatus,
        adminNote: input.adminNote?.trim() ?? current.adminNote,
        reviewedAt: new Date(),
        ...(input.status === 'REJECTED'
          ? { sessionTokenHash: null, sessionExpiresAt: null }
          : {}),
      },
    });

    const firstName = firstNameFromEmail(updated.email);
    if (input.status === 'APPROVED') {
      this.mail.sendBetaApproved({
        email: updated.email,
        firstName,
        testerTypeLabel: testerTypeLabel(updated.testerType),
      });
    } else {
      this.mail.sendBetaRejected({
        email: updated.email,
        firstName,
        adminNote: updated.adminNote,
      });
    }

    return presentRequest(updated);
  }

  async verifyAndIssueSession(input: {
    email: string;
    phone: string;
  }): Promise<{
    token: string;
    expiresInSec: number;
    request: BetaAccessRequestDto;
    whatsappCommunityUrl: string | null;
  }> {
    const email = normalizeEmail(input.email);
    const phone = normalizePhone(input.phone);
    if (!email || phone.length < 9) {
      throw new BadRequestException('Email ou telefone inválido.');
    }

    const row = await this.prisma.betaAccessRequest.findUnique({
      where: { email },
    });

    if (!row) {
      throw new ForbiddenException(
        'Não encontrámos este email na comunidade. Peça acesso primeiro.',
      );
    }

    if (row.phone !== phone) {
      throw new ForbiddenException(
        'O telefone não corresponde ao pedido. Use o mesmo número registado.',
      );
    }

    if (row.status === 'PENDING') {
      throw new ForbiddenException(
        'O seu pedido ainda está pendente de aprovação.',
      );
    }
    if (row.status === 'REJECTED') {
      throw new ForbiddenException(
        'O seu pedido foi rejeitado. Pode voltar a solicitar acesso.',
      );
    }

    const jti = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_SEC * 1000);
    const token = await this.jwt.signAsync(
      {
        sub: row.id,
        email: row.email,
        typ: 'beta',
        jti,
        testerType: row.testerType,
      },
      {
        secret: this.betaSecret(),
        expiresIn: SESSION_TTL_SEC,
      },
    );

    await this.prisma.betaAccessRequest.update({
      where: { id: row.id },
      data: {
        sessionTokenHash: hashToken(jti),
        sessionExpiresAt: expiresAt,
      },
    });

    const settings = await this.getSettings();

    return {
      token,
      expiresInSec: SESSION_TTL_SEC,
      request: presentRequest(row),
      whatsappCommunityUrl: settings.whatsappCommunityUrl,
    };
  }

  async validateSessionToken(token: string | undefined | null): Promise<
    | {
        ok: true;
        requestId: string;
        email: string;
        testerType: BetaTesterType;
      }
    | { ok: false }
  > {
    if (!token?.trim()) return { ok: false };
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        email: string;
        typ?: string;
        jti?: string;
        testerType?: BetaTesterType;
      }>(token, { secret: this.betaSecret() });

      if (payload.typ !== 'beta' || !payload.jti || !payload.sub) {
        return { ok: false };
      }

      const row = await this.prisma.betaAccessRequest.findUnique({
        where: { id: payload.sub },
      });
      if (!row || row.status !== 'APPROVED') return { ok: false };
      if (!row.sessionTokenHash || !row.sessionExpiresAt) return { ok: false };
      if (row.sessionExpiresAt.getTime() < Date.now()) return { ok: false };
      if (row.sessionTokenHash !== hashToken(payload.jti)) return { ok: false };
      if (row.email !== payload.email) return { ok: false };

      return {
        ok: true,
        requestId: row.id,
        email: row.email,
        testerType: row.testerType,
      };
    } catch {
      return { ok: false };
    }
  }

  async clearSession(requestId: string) {
    await this.prisma.betaAccessRequest.updateMany({
      where: { id: requestId },
      data: { sessionTokenHash: null, sessionExpiresAt: null },
    });
  }

  /**
   * Com beta activo, registo público exige pedido aprovado com o mesmo tipo.
   */
  async assertCanRegister(email: string, role: UserRole): Promise<void> {
    const settings = await this.ensureSettings();
    if (!settings.betaEnabled) return;

    const testerType = roleToTesterType(role);
    if (!testerType) {
      throw new ForbiddenException(
        'Durante o beta, só é possível criar conta de encarregado ou colégio.',
      );
    }

    const normalized = normalizeEmail(email);
    const row = await this.prisma.betaAccessRequest.findUnique({
      where: { email: normalized },
    });

    if (!row || row.status !== BetaAccessStatus.APPROVED) {
      throw new ForbiddenException(
        'Precisa de acesso aprovado na comunidade beta antes de criar conta.',
      );
    }

    if (row.testerType !== testerType) {
      throw new ForbiddenException(
        row.testerType === BetaTesterType.GUARDIAN
          ? 'Este email foi aprovado para testar como encarregado. Crie conta na área de encarregado.'
          : 'Este email foi aprovado para testar como colégio. Crie conta na área de instituição.',
      );
    }
  }

  private betaSecret(): string {
    return (
      this.config.get<string>('JWT_BETA_SECRET')?.trim() ||
      this.config.getOrThrow<string>('JWT_SECRET')
    );
  }
}
