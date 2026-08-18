import {
  GestaoModulePhase,
  GestaoWaitlistStatus,
  NotificationType,
  PlanCode,
  SchoolMembershipRole,
} from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/persistence/prisma/prisma.service';
import { SchoolHttpQueryService } from '../../school/infrastructure/http/school-http-query.service';
import { MailService } from '../../mail/application/mail.service';

const CONFIG_ID = 'default';

export type GestaoModuleConfigDto = {
  phase: GestaoModulePhase;
  description: string;
  testBaseUrl: string | null;
  updatedAt: string;
};

export type GestaoWaitlistEntryDto = {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolSlug: string;
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string;
  status: GestaoWaitlistStatus;
  testUrl: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
};

export type GestaoNotificationDto = {
  id: string;
  userId: string;
  schoolId: string | null;
  title: string;
  body: string;
  testUrl: string | null;
  read: boolean;
  createdAt: string;
};

function buildTestUrl(
  testBaseUrl: string | null | undefined,
  schoolSlug: string,
  override?: string | null,
): string | null {
  if (override?.trim()) return override.trim();
  if (!testBaseUrl?.trim()) return null;
  const base = testBaseUrl.replace(/\/$/, '');
  return `${base}/${schoolSlug}`;
}

function presentEntry(
  entry: {
    id: string;
    schoolId: string;
    schoolName: string;
    schoolSlug: string;
    ownerUserId: string;
    ownerName: string;
    ownerEmail: string;
    status: GestaoWaitlistStatus;
    testUrl: string | null;
    adminNote: string | null;
    createdAt: Date;
    updatedAt: Date;
    reviewedAt: Date | null;
  },
): GestaoWaitlistEntryDto {
  return {
    id: entry.id,
    schoolId: entry.schoolId,
    schoolName: entry.schoolName,
    schoolSlug: entry.schoolSlug,
    ownerUserId: entry.ownerUserId,
    ownerName: entry.ownerName,
    ownerEmail: entry.ownerEmail,
    status: entry.status,
    testUrl: entry.testUrl,
    adminNote: entry.adminNote,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    reviewedAt: entry.reviewedAt?.toISOString() ?? null,
  };
}

function presentConfig(config: {
  phase: GestaoModulePhase;
  description: string;
  testBaseUrl: string | null;
  updatedAt: Date;
}): GestaoModuleConfigDto {
  return {
    phase: config.phase,
    description: config.description,
    testBaseUrl: config.testBaseUrl,
    updatedAt: config.updatedAt.toISOString(),
  };
}

@Injectable()
export class GestaoRolloutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolQueries: SchoolHttpQueryService,
    private readonly mail: MailService,
  ) {}

  async getConfig(): Promise<GestaoModuleConfigDto> {
    const config = await this.ensureConfig();
    return presentConfig(config);
  }

  async updateConfig(input: {
    phase: GestaoModulePhase;
    description?: string;
    testBaseUrl?: string | null;
    notifyWaitlist?: boolean;
    notifyAllSchools?: boolean;
  }): Promise<GestaoModuleConfigDto> {
    const prev = await this.ensureConfig();
    const next = await this.prisma.gestaoModuleConfig.update({
      where: { id: CONFIG_ID },
      data: {
        phase: input.phase,
        ...(input.description !== undefined
          ? { description: input.description.trim() || prev.description }
          : {}),
        ...(input.testBaseUrl !== undefined
          ? { testBaseUrl: input.testBaseUrl }
          : {}),
      },
    });

    await this.syncManagementPlanVisibility(next.phase);

    if (
      input.notifyWaitlist &&
      (next.phase === GestaoModulePhase.WAITLIST ||
        next.phase === GestaoModulePhase.BETA)
    ) {
      const entries = await this.prisma.gestaoWaitlistEntry.findMany();
      await this.notifyUsers(
        entries.map((entry) => ({
          userId: entry.ownerUserId,
          schoolId: entry.schoolId,
          title: 'Plano de subscrição Gestão — fase de testes',
          body: next.description,
          testUrl:
            entry.status === GestaoWaitlistStatus.APPROVED
              ? entry.testUrl
              : null,
        })),
      );
    }

    if (input.notifyAllSchools && next.phase === GestaoModulePhase.PRODUCTION) {
      const owners = await this.prisma.schoolMembership.findMany({
        where: {
          role: SchoolMembershipRole.OWNER,
          status: 'ACTIVE',
        },
        select: { userId: true, schoolId: true },
        distinct: ['userId'],
      });

      await this.notifyUsers(
        owners.map((owner) => ({
          userId: owner.userId,
          schoolId: owner.schoolId,
          title: 'Plano de subscrição Gestão disponível',
          body: next.description,
          testUrl: null,
        })),
      );
    }

    return presentConfig(next);
  }

  async getMine(schoolId: string, userId: string) {
    await this.schoolQueries.assertMembership(schoolId, userId, [
      SchoolMembershipRole.OWNER,
      SchoolMembershipRole.ADMIN,
    ]);

    const module = await this.getConfig();
    const entry = await this.prisma.gestaoWaitlistEntry.findUnique({
      where: { schoolId },
    });

    const canJoin =
      (module.phase === GestaoModulePhase.WAITLIST ||
        module.phase === GestaoModulePhase.BETA) &&
      !entry;

    return {
      module,
      entry: entry ? presentEntry(entry) : null,
      canJoin,
    };
  }

  async joinWaitlist(input: {
    schoolId: string;
    userId: string;
    message?: string;
  }): Promise<GestaoWaitlistEntryDto> {
    const config = await this.ensureConfig();
    if (
      config.phase !== GestaoModulePhase.WAITLIST &&
      config.phase !== GestaoModulePhase.BETA
    ) {
      throw new BadRequestException(
        'O plano de subscrição Gestão ainda não aceita candidaturas.',
      );
    }

    await this.schoolQueries.assertMembership(input.schoolId, input.userId, [
      SchoolMembershipRole.OWNER,
    ]);

    const existing = await this.prisma.gestaoWaitlistEntry.findUnique({
      where: { schoolId: input.schoolId },
    });
    if (existing) {
      throw new ConflictException('Este colégio já está na fila.');
    }

    const [school, user] = await Promise.all([
      this.prisma.school.findUnique({ where: { id: input.schoolId } }),
      this.prisma.user.findUnique({ where: { id: input.userId } }),
    ]);

    if (!school || !user) {
      throw new NotFoundException('Colégio ou utilizador não encontrado.');
    }

    const ownerName = `${user.firstName} ${user.lastName}`.trim();

    const entry = await this.prisma.gestaoWaitlistEntry.create({
      data: {
        schoolId: school.id,
        schoolName: school.name,
        schoolSlug: school.slug,
        ownerUserId: user.id,
        ownerName,
        ownerEmail: user.email,
        adminNote: input.message?.trim() || null,
      },
    });

    this.mail.sendGestaoWaitlistReceived({
      email: user.email,
      ownerName: user.firstName,
      schoolName: school.name,
    });

    return presentEntry(entry);
  }

  async listWaitlist(params: {
    status?: GestaoWaitlistStatus;
    q?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const q = params.q?.trim().toLowerCase();

    const where = {
      ...(params.status ? { status: params.status } : {}),
      ...(q
        ? {
            OR: [
              { schoolName: { contains: q, mode: 'insensitive' as const } },
              { ownerName: { contains: q, mode: 'insensitive' as const } },
              { ownerEmail: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.gestaoWaitlistEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.gestaoWaitlistEntry.count({ where }),
    ]);

    return {
      items: items.map(presentEntry),
      total,
      page,
      pageSize,
    };
  }

  async reviewEntry(
    entryId: string,
    input: {
      status: 'APPROVED' | 'REJECTED';
      testUrl?: string;
      adminNote?: string;
    },
  ): Promise<GestaoWaitlistEntryDto> {
    const config = await this.ensureConfig();
    const current = await this.prisma.gestaoWaitlistEntry.findUnique({
      where: { id: entryId },
    });

    if (!current) {
      throw new NotFoundException('Candidatura não encontrada.');
    }

    const testUrl =
      input.status === 'APPROVED'
        ? buildTestUrl(config.testBaseUrl, current.schoolSlug, input.testUrl)
        : null;

    const updated = await this.prisma.gestaoWaitlistEntry.update({
      where: { id: entryId },
      data: {
        status: input.status as GestaoWaitlistStatus,
        testUrl,
        adminNote: input.adminNote?.trim() ?? current.adminNote,
        reviewedAt: new Date(),
      },
    });

    if (input.status === 'APPROVED') {
      await this.notifyUsers([
        {
          userId: updated.ownerUserId,
          schoolId: updated.schoolId,
          title: 'Acesso ao teste — plano Gestão',
          body: config.description,
          testUrl: updated.testUrl,
        },
      ]);
      this.mail.sendGestaoWaitlistApproved({
        email: updated.ownerEmail,
        ownerName: updated.ownerName.split(' ')[0] ?? updated.ownerName,
        schoolName: updated.schoolName,
        testUrl: updated.testUrl,
      });
    } else {
      this.mail.sendGestaoWaitlistRejected({
        email: updated.ownerEmail,
        ownerName: updated.ownerName.split(' ')[0] ?? updated.ownerName,
        schoolName: updated.schoolName,
        adminNote: updated.adminNote,
      });
    }

    return presentEntry(updated);
  }

  async listGestaoNotifications(userId: string): Promise<GestaoNotificationDto[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId, type: NotificationType.GESTAO },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      return {
        id: row.id,
        userId: row.userId,
        schoolId: typeof metadata.schoolId === 'string' ? metadata.schoolId : null,
        title: row.title,
        body: row.message,
        testUrl: typeof metadata.testUrl === 'string' ? metadata.testUrl : null,
        read: Boolean(row.readAt),
        createdAt: row.createdAt.toISOString(),
      };
    });
  }

  async markNotificationRead(notificationId: string, userId: string) {
    const row = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId, type: NotificationType.GESTAO },
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

  private async ensureConfig() {
    return this.prisma.gestaoModuleConfig.upsert({
      where: { id: CONFIG_ID },
      create: {
        id: CONFIG_ID,
        phase: GestaoModulePhase.WAITLIST,
        description:
          'O plano de subscrição Gestão transforma a Ekanda no sistema completo de gestão escolar: alunos, turmas, notas, propinas e comunicação com encarregados. Entre na fila para ser um dos primeiros colégios a testar.',
      },
      update: {},
    });
  }

  private async syncManagementPlanVisibility(phase: GestaoModulePhase) {
    const isProduction = phase === GestaoModulePhase.PRODUCTION;
    await this.prisma.plan.updateMany({
      where: { code: PlanCode.MANAGEMENT },
      data: isProduction
        ? { isPublic: true, isActive: true }
        : { isPublic: false },
    });
  }

  private async notifyUsers(
    items: Array<{
      userId: string;
      schoolId: string | null;
      title: string;
      body: string;
      testUrl: string | null;
    }>,
  ) {
    if (items.length === 0) return;

    await this.prisma.notification.createMany({
      data: items.map((item) => ({
        id: crypto.randomUUID(),
        userId: item.userId,
        type: NotificationType.GESTAO,
        title: item.title,
        message: item.body,
        metadata: {
          schoolId: item.schoolId,
          testUrl: item.testUrl,
          audience: 'school',
          source: 'gestao',
          href: '/dashboard/planos',
          ...(item.testUrl ? { externalUrl: item.testUrl } : {}),
        },
      })),
    });
  }
}
