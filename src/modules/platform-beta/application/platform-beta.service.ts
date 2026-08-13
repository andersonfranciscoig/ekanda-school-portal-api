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
import { BetaAccessStatus, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../../shared/infrastructure/persistence/prisma/prisma.service';

const SETTINGS_ID = 'default';
const SESSION_TTL_SEC = 14 * 24 * 60 * 60; // 14 days

export type PlatformSettingsDto = {
  betaEnabled: boolean;
  whatsappCommunityUrl: string | null;
  updatedAt: string;
};

export type BetaAccessRequestDto = {
  id: string;
  email: string;
  phone: string;
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
    status: row.status,
    adminNote: row.adminNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class PlatformBetaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async ensureSettings() {
    return this.prisma.platformSetting.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        betaEnabled: false,
        whatsappCommunityUrl: null,
      },
      update: {},
    });
  }

  async getSettings(): Promise<PlatformSettingsDto> {
    const row = await this.ensureSettings();
    return {
      betaEnabled: row.betaEnabled,
      whatsappCommunityUrl: row.whatsappCommunityUrl,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateSettings(input: {
    betaEnabled?: boolean;
    whatsappCommunityUrl?: string | null;
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
      },
    });
    return {
      betaEnabled: row.betaEnabled,
      whatsappCommunityUrl: row.whatsappCommunityUrl,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async requestAccess(input: {
    email: string;
    phone: string;
  }): Promise<BetaAccessRequestDto> {
    const email = normalizeEmail(input.email);
    const phone = normalizePhone(input.phone);
    if (!email || !email.includes('@')) {
      throw new BadRequestException('Email inválido.');
    }
    if (phone.length < 9) {
      throw new BadRequestException('Telefone inválido.');
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
        // Actualizar telefone se mudou
        if (existing.phone !== phone) {
          const updated = await this.prisma.betaAccessRequest.update({
            where: { id: existing.id },
            data: { phone },
          });
          return presentRequest(updated);
        }
        return presentRequest(existing);
      }
      // REJECTED → reabrir como PENDING
      const reopened = await this.prisma.betaAccessRequest.update({
        where: { id: existing.id },
        data: {
          phone,
          status: BetaAccessStatus.PENDING,
          adminNote: null,
          reviewedAt: null,
          sessionTokenHash: null,
          sessionExpiresAt: null,
        },
      });
      return presentRequest(reopened);
    }

    const created = await this.prisma.betaAccessRequest.create({
      data: {
        id: randomUUID(),
        email,
        phone,
      },
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
    return presentRequest(updated);
  }

  /**
   * Confirma email+telefone de um pedido APPROVED e emite JWT de sessão beta.
   * Devolve o token em claro para o controller setar o cookie; só o hash fica na BD.
   */
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
      { sub: row.id, email: row.email, typ: 'beta', jti },
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

  async validateSessionToken(token: string | undefined | null): Promise<{
    ok: true;
    requestId: string;
    email: string;
  } | { ok: false }> {
    if (!token?.trim()) return { ok: false };
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        email: string;
        typ?: string;
        jti?: string;
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

      return { ok: true, requestId: row.id, email: row.email };
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

  private betaSecret(): string {
    return (
      this.config.get<string>('JWT_BETA_SECRET')?.trim() ||
      this.config.getOrThrow<string>('JWT_SECRET')
    );
  }
}
