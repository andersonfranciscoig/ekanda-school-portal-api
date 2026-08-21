import {
  Inject,
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  NotificationType,
  SchoolMembershipRole,
  SchoolNifStatus,
  SchoolNifVerificationMode,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../shared/infrastructure/persistence/prisma/prisma.service';
import {
  AUDIT_LOGGER,
  type AuditLogger,
} from '../../../shared/application/ports/audit-logger.port';
import { SchoolHttpQueryService } from '../../school/infrastructure/http/school-http-query.service';
import { MailService } from '../../mail/application/mail.service';
import { InAppNotificationService } from '../../notification/application/in-app-notification.service';
import { PlatformBetaService } from '../../platform-beta/application/platform-beta.service';
import {
  autoNifEnvForceDisabled,
  computeNifDeadline,
  daysRemainingUntil,
  isValidNifFormat,
  LEGAL_SECTION_NIF,
  needsNifSubmission,
  normalizeNif,
} from './school-legal.constants';
import {
  NIF_LOOKUP_PORT,
  type NifLookupPort,
  type NifLookupSnapshot,
} from './ports/nif-lookup.port';

type SectionUnread = Record<string, boolean>;

type SchoolLegalNifDto = {
  nif: string | null;
  status: SchoolNifStatus;
  submittedAt: string | null;
  consentAt: string | null;
  verifiedAt: string | null;
  verifiedByUserId: string | null;
  verifiedByName: string | null;
  verificationMode: SchoolNifVerificationMode | null;
  rejectionReason: string | null;
  lookupSnapshot: Record<string, unknown> | null;
};

export type SchoolLegalNifDeadlineDto = {
  deadlineAt: string;
  daysRemaining: number;
  overdue: boolean;
} | null;

export type SchoolLegalOverviewDto = {
  schoolId: string;
  ownerUserId: string | null;
  nif: SchoolLegalNifDto;
  nifDeadline: SchoolLegalNifDeadlineDto;
  sections: Array<{
    id: string;
    title: string;
    description: string;
    path: string;
    status: 'pending' | 'action_required' | 'complete' | 'unavailable';
    hasUnreadUpdate: boolean;
  }>;
  hasUnreadUpdates: boolean;
  autoNifVerificationEnabled: boolean;
};

const LEGAL_AUDIT_ACTIONS = [
  'NIF_SUBMITTED',
  'NIF_VERIFIED_MANUAL',
  'NIF_VERIFIED_AUTO',
  'NIF_REJECTED',
] as const;

export type SchoolLegalNotificationDto = {
  id: string;
  userId: string;
  schoolId: string;
  title: string;
  body: string;
  sectionId: string;
  read: boolean;
  createdAt: string;
};

export type SchoolLegalAuditDto = {
  id: string;
  schoolId: string;
  schoolName: string;
  action: string;
  actorUserId: string;
  actorName: string;
  nif: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AdminLegalSchoolListItemDto = {
  schoolId: string;
  schoolName: string;
  schoolStatus: string;
  ownerEmail: string | null;
  nif: string | null;
  nifStatus: SchoolNifStatus;
  submittedAt: string | null;
  verifiedAt: string | null;
  verifiedByName: string | null;
  rejectionReason: string | null;
};

export type AdminLegalSummaryDto = {
  pendingVerification: number;
  verified: number;
  notSubmitted: number;
  rejected: number;
};

function parseSectionUnread(value: unknown): SectionUnread {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as SectionUnread;
}

function nifSectionStatus(
  status: SchoolNifStatus,
): SchoolLegalOverviewDto['sections'][0]['status'] {
  switch (status) {
    case 'NOT_SUBMITTED':
      return 'action_required';
    case 'SUBMITTED':
      return 'pending';
    case 'VERIFIED':
      return 'complete';
    case 'REJECTED':
      return 'action_required';
  }
}

function presentNif(profile: {
  nif: string | null;
  nifStatus: SchoolNifStatus;
  submittedAt: Date | null;
  consentAt: Date | null;
  verifiedAt: Date | null;
  verifiedByUserId: string | null;
  verifiedByName: string | null;
  verificationMode: SchoolNifVerificationMode | null;
  rejectionReason: string | null;
  lookupSnapshot: Prisma.JsonValue | null;
}): SchoolLegalNifDto {
  return {
    nif: profile.nif,
    status: profile.nifStatus,
    submittedAt: profile.submittedAt?.toISOString() ?? null,
    consentAt: profile.consentAt?.toISOString() ?? null,
    verifiedAt: profile.verifiedAt?.toISOString() ?? null,
    verifiedByUserId: profile.verifiedByUserId,
    verifiedByName: profile.verifiedByName,
    verificationMode: profile.verificationMode,
    rejectionReason: profile.rejectionReason,
    lookupSnapshot:
      profile.lookupSnapshot && typeof profile.lookupSnapshot === 'object'
        ? (profile.lookupSnapshot as Record<string, unknown>)
        : null,
  };
}

function presentNifDeadline(
  profile: {
    nifStatus: SchoolNifStatus;
    nifDeadlineAt: Date | null;
  },
  now = new Date(),
): SchoolLegalNifDeadlineDto {
  if (!needsNifSubmission(profile.nifStatus) || !profile.nifDeadlineAt) return null;
  const daysRemaining = daysRemainingUntil(profile.nifDeadlineAt, now);
  return {
    deadlineAt: profile.nifDeadlineAt.toISOString(),
    daysRemaining,
    overdue: daysRemaining < 0,
  };
}

function presentOverview(
  schoolId: string,
  profile: {
    ownerUserId: string | null;
    nif: string | null;
    nifStatus: SchoolNifStatus;
    submittedAt: Date | null;
    consentAt: Date | null;
    verifiedAt: Date | null;
    verifiedByUserId: string | null;
    verifiedByName: string | null;
    verificationMode: SchoolNifVerificationMode | null;
    rejectionReason: string | null;
    lookupSnapshot: Prisma.JsonValue | null;
    sectionUnread: Prisma.JsonValue;
    nifDeadlineAt: Date | null;
  },
  autoNifVerificationEnabled: boolean,
): SchoolLegalOverviewDto {
  const unread = parseSectionUnread(profile.sectionUnread);
  const nifUnread = Boolean(unread[LEGAL_SECTION_NIF.id]);
  return {
    schoolId,
    ownerUserId: profile.ownerUserId,
    nif: presentNif(profile),
    nifDeadline: presentNifDeadline(profile),
    hasUnreadUpdates: Object.values(unread).some(Boolean),
    autoNifVerificationEnabled,
    sections: [
      {
        ...LEGAL_SECTION_NIF,
        status: nifSectionStatus(profile.nifStatus),
        hasUnreadUpdate: nifUnread,
      },
    ],
  };
}

@Injectable()
export class SchoolLegalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolQueries: SchoolHttpQueryService,
    private readonly mail: MailService,
    private readonly notifications: InAppNotificationService,
    private readonly platform: PlatformBetaService,
    @Inject(NIF_LOOKUP_PORT)
    private readonly nifLookup: NifLookupPort,
    @Inject(AUDIT_LOGGER)
    private readonly audit: AuditLogger,
  ) {}

  private async isAutoNifEnabled(): Promise<boolean> {
    if (autoNifEnvForceDisabled()) return false;
    const settings = await this.platform.ensureSettings();
    return Boolean(settings.autoNifVerificationEnabled);
  }

  private async present(
    schoolId: string,
    profile: Parameters<typeof presentOverview>[1],
  ): Promise<SchoolLegalOverviewDto> {
    return presentOverview(schoolId, profile, await this.isAutoNifEnabled());
  }

  async getOverview(schoolId: string, userId: string): Promise<SchoolLegalOverviewDto> {
    await this.schoolQueries.assertMembership(schoolId, userId, [
      SchoolMembershipRole.OWNER,
      SchoolMembershipRole.ADMIN,
    ]);

    const profile = await this.syncNifDeadline(await this.ensureProfile(schoolId, userId));
    return this.present(schoolId, profile);
  }

  async submitNif(
    schoolId: string,
    userId: string,
    input: { nif: string; consentAccepted: true },
  ): Promise<SchoolLegalOverviewDto> {
    await this.schoolQueries.assertMembership(schoolId, userId, [
      SchoolMembershipRole.OWNER,
      SchoolMembershipRole.ADMIN,
    ]);

    const normalized = normalizeNif(input.nif);
    if (!isValidNifFormat(normalized)) {
      throw new BadRequestException(
        'Formato de NIF inválido. Use o formato angolano (ex.: 004846965LA044).',
      );
    }

    const duplicate = await this.prisma.schoolLegalProfile.findFirst({
      where: { nif: normalized, NOT: { schoolId } },
    });
    if (duplicate) {
      throw new ConflictException('Este NIF já está associado a outro colégio na Ekanda.');
    }

    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('Colégio não encontrado.');

    const now = new Date();
    const profile = await this.prisma.schoolLegalProfile.upsert({
      where: { schoolId },
      create: {
        id: randomUUID(),
        schoolId,
        ownerUserId: userId,
        nif: normalized,
        nifStatus: SchoolNifStatus.SUBMITTED,
        submittedAt: now,
        consentAt: now,
        rejectionReason: null,
        sectionUnread: {} as Prisma.InputJsonValue,
      },
      update: {
        ownerUserId: userId,
        nif: normalized,
        nifStatus: SchoolNifStatus.SUBMITTED,
        submittedAt: now,
        consentAt: now,
        rejectionReason: null,
        verifiedAt: null,
        verifiedByUserId: null,
        verifiedByName: null,
        verificationMode: null,
        lookupSnapshot: Prisma.DbNull,
        nifDeadlineAt: null,
        nifReminderSentAt: null,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'NIF_SUBMITTED',
      entity: 'SCHOOL_LEGAL',
      entityId: schoolId,
      metadata: {
        nif: normalized,
        entityLabel: school.name,
      },
    });

    const ownerMembership = await this.prisma.schoolMembership.findFirst({
      where: {
        schoolId,
        role: SchoolMembershipRole.OWNER,
        status: 'ACTIVE',
      },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });

    if (await this.isAutoNifEnabled()) {
      try {
        return await this.verifyNifAutomatic(schoolId, {
          userId,
          name: 'Sistema (AGT)',
          triggeredBy: 'SUBMIT',
        });
      } catch {
        // Mantém SUBMITTED e segue o fluxo manual (ops + colégio).
      }
    }

    this.mail.sendSchoolNifSubmittedOps({
      schoolId,
      schoolName: school.name,
      nif: normalized,
      ownerEmail: ownerMembership?.user.email ?? '—',
    });

    await this.notifications.notifyEkandaAdmins({
      type: NotificationType.LEGAL,
      audience: 'admin',
      source: 'legal',
      title: 'NIF submetido — aguarda validação',
      message: `${school.name} submeteu o NIF ${normalized}.`,
      href: `/portal-ops-7f3a/colegios/${schoolId}`,
      metadata: { schoolId, nif: normalized, sectionId: LEGAL_SECTION_NIF.id },
    });

    await this.notifications.notifySchoolMembers(schoolId, {
      type: NotificationType.LEGAL,
      audience: 'school',
      source: 'legal',
      title: 'NIF enviado para validação',
      message: `O NIF de ${school.name} foi submetido. A equipa Ekanda irá validar junto da AGT.`,
      href: '/dashboard/juridico/nif',
      metadata: { schoolId, sectionId: LEGAL_SECTION_NIF.id },
    });

    return this.present(schoolId, profile);
  }

  async markSectionRead(schoolId: string, userId: string, sectionId: string) {
    await this.schoolQueries.assertMembership(schoolId, userId, [
      SchoolMembershipRole.OWNER,
      SchoolMembershipRole.ADMIN,
    ]);

    const profile = await this.ensureProfile(schoolId, userId);
    const unread = parseSectionUnread(profile.sectionUnread);
    unread[sectionId] = false;

    await this.prisma.schoolLegalProfile.update({
      where: { schoolId },
      data: { sectionUnread: unread as Prisma.InputJsonValue },
    });

    return { read: true };
  }

  async getForAdmin(schoolId: string): Promise<SchoolLegalOverviewDto | null> {
    const profile = await this.prisma.schoolLegalProfile.findUnique({
      where: { schoolId },
    });
    if (!profile) return null;
    const synced = await this.syncNifDeadline(profile);
    return this.present(schoolId, synced);
  }

  async verifyNifManual(
    schoolId: string,
    admin: { userId: string; name: string },
  ): Promise<SchoolLegalOverviewDto> {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('Colégio não encontrado.');

    const profile = await this.prisma.schoolLegalProfile.findUnique({
      where: { schoolId },
    });
    if (!profile?.nif || profile.nifStatus !== SchoolNifStatus.SUBMITTED) {
      throw new BadRequestException(
        'Só é possível validar NIF que esteja no estado SUBMITTED (aguarda validação).',
      );
    }

    const updated = await this.markNifVerified({
      schoolId,
      schoolName: school.name,
      nif: profile.nif,
      actorUserId: admin.userId,
      actorName: admin.name,
      mode: SchoolNifVerificationMode.MANUAL,
      sectionUnread: profile.sectionUnread,
      lookupSnapshot: null,
      auditAction: 'NIF_VERIFIED_MANUAL',
    });

    return this.present(schoolId, updated);
  }

  /**
   * Validação automática via porta AGT (contrato isolado).
   * Requer toggle admin activo + provider configurado (`AGT_NIF_LOOKUP_BASE_URL`).
   */
  async verifyNifAutomatic(
    schoolId: string,
    actor: { userId: string; name: string; triggeredBy?: 'ADMIN' | 'SUBMIT' },
  ): Promise<SchoolLegalOverviewDto> {
    if (!(await this.isAutoNifEnabled())) {
      throw new BadRequestException(
        'Validação automática de NIF está desactivada. Active-a em Configurações (admin).',
      );
    }
    if (!this.nifLookup.isConfigured()) {
      throw new ServiceUnavailableException(
        'Consulta AGT ainda não configurada. Defina AGT_NIF_LOOKUP_BASE_URL após o credenciamento.',
      );
    }

    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('Colégio não encontrado.');

    const profile = await this.prisma.schoolLegalProfile.findUnique({
      where: { schoolId },
    });
    if (!profile?.nif || profile.nifStatus !== SchoolNifStatus.SUBMITTED) {
      throw new BadRequestException(
        'Só é possível validar automaticamente NIF no estado SUBMITTED.',
      );
    }

    const lookup = await this.nifLookup.lookup(profile.nif);

    if (lookup.verdict === 'ACTIVE') {
      const updated = await this.markNifVerified({
        schoolId,
        schoolName: school.name,
        nif: profile.nif,
        actorUserId: actor.userId,
        actorName: actor.name,
        mode: SchoolNifVerificationMode.AUTOMATIC,
        sectionUnread: profile.sectionUnread,
        lookupSnapshot: lookup.snapshot,
        auditAction: 'NIF_VERIFIED_AUTO',
        auditExtra: { triggeredBy: actor.triggeredBy ?? 'ADMIN', verdict: lookup.verdict },
      });
      return this.present(schoolId, updated);
    }

    const reason =
      lookup.verdict === 'NOT_FOUND'
        ? 'NIF não encontrado no registo AGT.'
        : lookup.verdict === 'INACTIVE'
          ? `Contribuinte inactivo na AGT${lookup.snapshot.estado ? ` (estado: ${lookup.snapshot.estado})` : ''}.`
          : 'Não foi possível confirmar o estado activo do NIF na AGT. Validação manual necessária.';

    if (lookup.verdict === 'UNKNOWN') {
      throw new BadRequestException(reason);
    }

    // INACTIVE / NOT_FOUND → rejeição automática
    const unread = parseSectionUnread(profile.sectionUnread);
    unread[LEGAL_SECTION_NIF.id] = true;

    const updated = await this.prisma.schoolLegalProfile.update({
      where: { schoolId },
      data: {
        nifStatus: SchoolNifStatus.REJECTED,
        rejectionReason: reason,
        verifiedAt: null,
        verifiedByUserId: null,
        verifiedByName: null,
        verificationMode: null,
        lookupSnapshot: lookup.snapshot as unknown as Prisma.InputJsonValue,
        sectionUnread: unread as Prisma.InputJsonValue,
      },
    });

    await this.audit.log({
      actorUserId: actor.userId,
      action: 'NIF_REJECTED',
      entity: 'SCHOOL_LEGAL',
      entityId: schoolId,
      metadata: {
        nif: profile.nif,
        entityLabel: school.name,
        reason,
        actorName: actor.name,
        mode: 'AUTOMATIC',
        verdict: lookup.verdict,
        triggeredBy: actor.triggeredBy ?? 'ADMIN',
      },
    });

    await this.notifyOwnerNifRejected(schoolId, school.name, reason);

    return this.present(schoolId, updated);
  }

  async rejectNif(
    schoolId: string,
    admin: { userId: string; name: string },
    reason: string,
  ): Promise<SchoolLegalOverviewDto> {
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      throw new BadRequestException('Indique um motivo com pelo menos 5 caracteres.');
    }

    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('Colégio não encontrado.');

    const existing = await this.prisma.schoolLegalProfile.findUnique({
      where: { schoolId },
    });
    if (!existing?.nif || existing.nifStatus !== SchoolNifStatus.SUBMITTED) {
      throw new BadRequestException(
        'Só é possível rejeitar NIF que esteja aguardando validação (SUBMITTED).',
      );
    }

    const unread = parseSectionUnread(existing.sectionUnread);
    unread[LEGAL_SECTION_NIF.id] = true;

    const updated = await this.prisma.schoolLegalProfile.update({
      where: { schoolId },
      data: {
        nifStatus: SchoolNifStatus.REJECTED,
        rejectionReason: trimmed,
        verifiedAt: null,
        verifiedByUserId: null,
        verifiedByName: null,
        verificationMode: null,
        sectionUnread: unread as Prisma.InputJsonValue,
      },
    });

    await this.audit.log({
      actorUserId: admin.userId,
      action: 'NIF_REJECTED',
      entity: 'SCHOOL_LEGAL',
      entityId: schoolId,
      metadata: {
        nif: updated.nif,
        entityLabel: school.name,
        reason: trimmed,
        actorName: admin.name,
      },
    });

    await this.notifyOwnerNifRejected(schoolId, school.name, trimmed);

    return this.present(schoolId, updated);
  }

  async getLegalSummary(): Promise<AdminLegalSummaryDto> {
    const [pendingVerification, verified, notSubmitted, rejected] = await Promise.all([
      this.prisma.schoolLegalProfile.count({
        where: { nifStatus: SchoolNifStatus.SUBMITTED },
      }),
      this.prisma.schoolLegalProfile.count({
        where: { nifStatus: SchoolNifStatus.VERIFIED },
      }),
      this.prisma.schoolLegalProfile.count({
        where: { nifStatus: SchoolNifStatus.NOT_SUBMITTED },
      }),
      this.prisma.schoolLegalProfile.count({
        where: { nifStatus: SchoolNifStatus.REJECTED },
      }),
    ]);

    return { pendingVerification, verified, notSubmitted, rejected };
  }

  async listSchoolsForAdmin(input?: {
    nifStatus?: SchoolNifStatus;
    q?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, input?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, input?.pageSize ?? 20));
    const skip = (page - 1) * pageSize;
    const q = input?.q?.trim();

    const where: Prisma.SchoolLegalProfileWhereInput = {
      ...(input?.nifStatus ? { nifStatus: input.nifStatus } : {}),
      ...(q
        ? {
            OR: [
              { nif: { contains: q, mode: 'insensitive' } },
              {
                school: {
                  OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    {
                      memberships: {
                        some: {
                          role: SchoolMembershipRole.OWNER,
                          user: { email: { contains: q, mode: 'insensitive' } },
                        },
                      },
                    },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.schoolLegalProfile.findMany({
        where,
        include: {
          school: {
            select: {
              id: true,
              name: true,
              status: true,
              memberships: {
                where: { role: SchoolMembershipRole.OWNER, status: 'ACTIVE' },
                take: 1,
                include: { user: { select: { email: true } } },
              },
            },
          },
        },
        orderBy: [{ submittedAt: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.schoolLegalProfile.count({ where }),
    ]);

    const items: AdminLegalSchoolListItemDto[] = rows.map((row) => ({
      schoolId: row.schoolId,
      schoolName: row.school.name,
      schoolStatus: row.school.status,
      ownerEmail: row.school.memberships[0]?.user.email ?? null,
      nif: row.nif,
      nifStatus: row.nifStatus,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      verifiedAt: row.verifiedAt?.toISOString() ?? null,
      verifiedByName: row.verifiedByName,
      rejectionReason: row.rejectionReason,
    }));

    return { items, total, page, pageSize };
  }

  async notifySchoolApproved(schoolId: string) {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('Colégio não encontrado.');

    const membership = await this.prisma.schoolMembership.findFirst({
      where: {
        schoolId,
        role: SchoolMembershipRole.OWNER,
        status: 'ACTIVE',
      },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });

    const owner = membership?.user;
    if (!owner?.email) return { notified: false };

    const ownerName = owner.firstName?.trim() || owner.email;
    const nifDeadlineAt = computeNifDeadline(school.reviewedAt ?? school.createdAt);

    const profile = await this.ensureProfile(schoolId, owner.id);
    const unread = parseSectionUnread(profile.sectionUnread);
    unread[LEGAL_SECTION_NIF.id] = true;

    await this.prisma.schoolLegalProfile.update({
      where: { schoolId },
      data: {
        ownerUserId: owner.id,
        sectionUnread: unread as Prisma.InputJsonValue,
        nifDeadlineAt,
        nifReminderSentAt: null,
      },
    });

    await this.createLegalNotification({
      userId: owner.id,
      schoolId,
      title: 'Cadastro aprovado — área Jurídica',
      body: 'O perfil do seu colégio foi aprovado. Consulte a validação fiscal (NIF) na área Jurídica.',
    });

    this.mail.sendSchoolLegalApproved({
      email: owner.email,
      ownerName,
      schoolName: school.name,
    });

    return { notified: true };
  }

  async listLegalNotifications(userId: string): Promise<SchoolLegalNotificationDto[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId, type: NotificationType.LEGAL },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      return {
        id: row.id,
        userId: row.userId,
        schoolId: typeof metadata.schoolId === 'string' ? metadata.schoolId : '',
        title: row.title,
        body: row.message,
        sectionId:
          typeof metadata.sectionId === 'string' ? metadata.sectionId : LEGAL_SECTION_NIF.id,
        read: Boolean(row.readAt),
        createdAt: row.createdAt.toISOString(),
      };
    });
  }

  async markNotificationRead(notificationId: string, userId: string) {
    const row = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId, type: NotificationType.LEGAL },
    });

    if (!row) {
      throw new NotFoundException('Notificação não encontrada.');
    }

    if (!row.readAt) {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { readAt: new Date() },
      });
    }

    return { read: true };
  }

  async listAudit(input?: { schoolId?: string; limit?: number }): Promise<SchoolLegalAuditDto[]> {
    const limit = Math.min(Math.max(input?.limit ?? 100, 1), 500);
    const rows = await this.prisma.auditLog.findMany({
      where: {
        entity: 'SCHOOL_LEGAL',
        action: { in: [...LEGAL_AUDIT_ACTIONS] },
        ...(input?.schoolId ? { entityId: input.schoolId } : {}),
      },
      include: {
        actor: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return rows.map((row) => {
      const metadata =
        row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : {};

      const actorName =
        row.actor
          ? `${row.actor.firstName} ${row.actor.lastName}`.trim() || row.actor.email
          : typeof metadata.actorName === 'string'
            ? metadata.actorName
            : 'Sistema';

      return {
        id: row.id,
        schoolId: row.entityId ?? '',
        schoolName:
          typeof metadata.entityLabel === 'string' ? metadata.entityLabel : '',
        action: row.action,
        actorUserId: row.actorUserId ?? '',
        actorName,
        nif: typeof metadata.nif === 'string' ? metadata.nif : null,
        metadata,
        createdAt: row.createdAt.toISOString(),
      };
    });
  }

  private async syncNifDeadline(profile: {
    schoolId: string;
    nifStatus: SchoolNifStatus;
    nifDeadlineAt: Date | null;
    nifReminderSentAt: Date | null;
    ownerUserId: string | null;
    nif: string | null;
    submittedAt: Date | null;
    consentAt: Date | null;
    verifiedAt: Date | null;
    verifiedByUserId: string | null;
    verifiedByName: string | null;
    verificationMode: SchoolNifVerificationMode | null;
    rejectionReason: string | null;
    lookupSnapshot: Prisma.JsonValue | null;
    sectionUnread: Prisma.JsonValue;
  }) {
    if (
      profile.nifStatus === SchoolNifStatus.SUBMITTED ||
      profile.nifStatus === SchoolNifStatus.VERIFIED
    ) {
      if (!profile.nifDeadlineAt && !profile.nifReminderSentAt) return profile;
      return this.prisma.schoolLegalProfile.update({
        where: { schoolId: profile.schoolId },
        data: { nifDeadlineAt: null, nifReminderSentAt: null },
      });
    }

    if (profile.nifDeadlineAt) return profile;

    const school = await this.prisma.school.findUnique({
      where: { id: profile.schoolId },
      select: { status: true, reviewedAt: true, createdAt: true },
    });
    if (school?.status !== 'ACTIVE') return profile;

    return this.prisma.schoolLegalProfile.update({
      where: { schoolId: profile.schoolId },
      data: { nifDeadlineAt: computeNifDeadline(school.reviewedAt ?? school.createdAt) },
    });
  }

  private async ensureProfile(schoolId: string, ownerUserId?: string) {
    const existing = await this.prisma.schoolLegalProfile.findUnique({
      where: { schoolId },
    });
    if (existing) {
      if (ownerUserId && existing.ownerUserId !== ownerUserId) {
        return this.prisma.schoolLegalProfile.update({
          where: { schoolId },
          data: { ownerUserId },
        });
      }
      return existing;
    }

    return this.prisma.schoolLegalProfile.create({
      data: {
        id: randomUUID(),
        schoolId,
        ownerUserId: ownerUserId ?? null,
        nifStatus: SchoolNifStatus.NOT_SUBMITTED,
        sectionUnread: {} as Prisma.InputJsonValue,
      },
    });
  }

  private async markNifVerified(input: {
    schoolId: string;
    schoolName: string;
    nif: string;
    actorUserId: string;
    actorName: string;
    mode: SchoolNifVerificationMode;
    sectionUnread: Prisma.JsonValue;
    lookupSnapshot: NifLookupSnapshot | null;
    auditAction: 'NIF_VERIFIED_MANUAL' | 'NIF_VERIFIED_AUTO';
    auditExtra?: Record<string, unknown>;
  }) {
    const now = new Date();
    const unread = parseSectionUnread(input.sectionUnread);
    unread[LEGAL_SECTION_NIF.id] = true;

    const updated = await this.prisma.schoolLegalProfile.update({
      where: { schoolId: input.schoolId },
      data: {
        nifStatus: SchoolNifStatus.VERIFIED,
        verifiedAt: now,
        verifiedByUserId: input.actorUserId,
        verifiedByName: input.actorName,
        verificationMode: input.mode,
        rejectionReason: null,
        lookupSnapshot: input.lookupSnapshot
          ? (input.lookupSnapshot as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
        sectionUnread: unread as Prisma.InputJsonValue,
        nifDeadlineAt: null,
        nifReminderSentAt: null,
      },
    });

    await this.audit.log({
      actorUserId: input.actorUserId,
      action: input.auditAction,
      entity: 'SCHOOL_LEGAL',
      entityId: input.schoolId,
      metadata: {
        nif: input.nif,
        entityLabel: input.schoolName,
        mode: input.mode,
        actorName: input.actorName,
        ...(input.auditExtra ?? {}),
      },
    });

    const ownerMembership = await this.prisma.schoolMembership.findFirst({
      where: {
        schoolId: input.schoolId,
        role: SchoolMembershipRole.OWNER,
        status: 'ACTIVE',
      },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    const owner = ownerMembership?.user;

    if (owner?.id) {
      await this.createLegalNotification({
        userId: owner.id,
        schoolId: input.schoolId,
        title: 'NIF validado',
        body:
          input.mode === SchoolNifVerificationMode.AUTOMATIC
            ? 'O NIF do seu colégio foi validado automaticamente junto da AGT. Consulte o estado na área Jurídica.'
            : 'A equipa Ekanda validou o NIF do seu colégio. Consulte o estado na área Jurídica.',
      });
    }

    if (owner?.email) {
      this.mail.sendSchoolNifVerified({
        email: owner.email,
        ownerName: owner.firstName?.trim() || owner.email,
        schoolName: input.schoolName,
        nif: input.nif,
      });
    }

    return updated;
  }

  private async notifyOwnerNifRejected(schoolId: string, schoolName: string, reason: string) {
    const ownerMembership = await this.prisma.schoolMembership.findFirst({
      where: {
        schoolId,
        role: SchoolMembershipRole.OWNER,
        status: 'ACTIVE',
      },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    const owner = ownerMembership?.user;

    if (owner?.id) {
      await this.createLegalNotification({
        userId: owner.id,
        schoolId,
        title: 'NIF não validado',
        body: `A validação do NIF do colégio foi recusada. Motivo: ${reason}`,
      });
    }

    if (owner?.email) {
      this.mail.sendSchoolNifRejected({
        email: owner.email,
        ownerName: owner.firstName?.trim() || owner.email,
        schoolName,
        reason,
      });
    }
  }

  private async createLegalNotification(input: {
    userId: string;
    schoolId: string;
    title: string;
    body: string;
  }) {
    await this.notifications.create({
      userId: input.userId,
      type: NotificationType.LEGAL,
      audience: 'school',
      source: 'legal',
      title: input.title,
      message: input.body,
      href: '/dashboard/juridico/nif',
      metadata: {
        schoolId: input.schoolId,
        sectionId: LEGAL_SECTION_NIF.id,
      },
    });
  }
}
