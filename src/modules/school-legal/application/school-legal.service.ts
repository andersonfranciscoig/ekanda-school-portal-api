import {
  Inject,
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
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
import {
  autoNifVerificationEnabled,
  computeNifDeadline,
  daysRemainingUntil,
  isValidNifFormat,
  LEGAL_SECTION_NIF,
  needsNifSubmission,
  normalizeNif,
} from './school-legal.constants';

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
): SchoolLegalOverviewDto {
  const unread = parseSectionUnread(profile.sectionUnread);
  const nifUnread = Boolean(unread[LEGAL_SECTION_NIF.id]);
  return {
    schoolId,
    ownerUserId: profile.ownerUserId,
    nif: presentNif(profile),
    nifDeadline: presentNifDeadline(profile),
    hasUnreadUpdates: Object.values(unread).some(Boolean),
    autoNifVerificationEnabled: autoNifVerificationEnabled(),
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
    @Inject(AUDIT_LOGGER)
    private readonly audit: AuditLogger,
  ) {}

  async getOverview(schoolId: string, userId: string): Promise<SchoolLegalOverviewDto> {
    await this.schoolQueries.assertMembership(schoolId, userId, [
      SchoolMembershipRole.OWNER,
      SchoolMembershipRole.ADMIN,
    ]);

    const profile = await this.syncNifDeadline(await this.ensureProfile(schoolId, userId));
    return presentOverview(schoolId, profile);
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

    return presentOverview(schoolId, profile);
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
    return presentOverview(schoolId, synced);
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

    const now = new Date();
    const unread = parseSectionUnread(profile?.sectionUnread ?? {});
    unread[LEGAL_SECTION_NIF.id] = true;

    const updated = await this.prisma.schoolLegalProfile.upsert({
      where: { schoolId },
      create: {
        id: randomUUID(),
        schoolId,
        nifStatus: SchoolNifStatus.VERIFIED,
        verifiedAt: now,
        verifiedByUserId: admin.userId,
        verifiedByName: admin.name,
        verificationMode: SchoolNifVerificationMode.MANUAL,
        sectionUnread: unread as Prisma.InputJsonValue,
        nifDeadlineAt: null,
        nifReminderSentAt: null,
      },
      update: {
        nifStatus: SchoolNifStatus.VERIFIED,
        verifiedAt: now,
        verifiedByUserId: admin.userId,
        verifiedByName: admin.name,
        verificationMode: SchoolNifVerificationMode.MANUAL,
        sectionUnread: unread as Prisma.InputJsonValue,
        nifDeadlineAt: null,
        nifReminderSentAt: null,
      },
    });

    await this.audit.log({
      actorUserId: admin.userId,
      action: 'NIF_VERIFIED_MANUAL',
      entity: 'SCHOOL_LEGAL',
      entityId: schoolId,
      metadata: {
        nif: updated.nif,
        entityLabel: school.name,
        mode: 'MANUAL',
        actorName: admin.name,
      },
    });

    if (updated.ownerUserId) {
      await this.createLegalNotification({
        userId: updated.ownerUserId,
        schoolId,
        title: 'Validação fiscal actualizada',
        body: 'A equipa Ekanda concluiu a validação do NIF do seu colégio. Consulte o estado na área Jurídica.',
      });
    }

    return presentOverview(schoolId, updated);
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

  private async createLegalNotification(input: {
    userId: string;
    schoolId: string;
    title: string;
    body: string;
  }) {
    await this.prisma.notification.create({
      data: {
        id: randomUUID(),
        userId: input.userId,
        type: NotificationType.LEGAL,
        title: input.title,
        message: input.body,
        metadata: {
          schoolId: input.schoolId,
          sectionId: LEGAL_SECTION_NIF.id,
        } as Prisma.InputJsonValue,
      },
    });
  }
}
