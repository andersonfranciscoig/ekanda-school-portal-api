import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../shared/infrastructure/persistence/prisma/prisma.service';

export type NotificationAudience = 'admin' | 'school' | 'guardian';

export type NotificationSource =
  | 'platform'
  | 'legal'
  | 'gestao'
  | 'candidatura'
  | 'visita'
  | 'pagamento';

export type InAppNotificationDto = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  source: NotificationSource;
  href: string | null;
  externalUrl: string | null;
};

export type CreateInAppNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  audience: NotificationAudience;
  source: NotificationSource;
  href?: string;
  externalUrl?: string;
  metadata?: Record<string, unknown>;
};

const SOURCE_BY_TYPE: Record<NotificationType, NotificationSource> = {
  SYSTEM: 'platform',
  APPLICATION: 'candidatura',
  PAYMENT: 'pagamento',
  SUBSCRIPTION: 'pagamento',
  SCHOOL: 'platform',
  SECURITY: 'platform',
  GESTAO: 'gestao',
  LEGAL: 'legal',
};

@Injectable()
export class InAppNotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateInAppNotificationInput) {
    await this.prisma.notification.create({
      data: {
        id: randomUUID(),
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        metadata: this.buildMetadata(input) as Prisma.InputJsonValue,
      },
    });
  }

  async createMany(inputs: CreateInAppNotificationInput[]) {
    if (inputs.length === 0) return;
    await this.prisma.notification.createMany({
      data: inputs.map((input) => ({
        id: randomUUID(),
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        metadata: this.buildMetadata(input) as Prisma.InputJsonValue,
      })),
    });
  }

  async notifySchoolMembers(
    schoolId: string,
    input: Omit<CreateInAppNotificationInput, 'userId'>,
  ) {
    const memberships = await this.prisma.schoolMembership.findMany({
      where: { schoolId, status: 'ACTIVE' },
      select: { userId: true },
    });
    await this.createMany(
      memberships.map((item) => ({ ...input, userId: item.userId })),
    );
  }

  async notifyEkandaAdmins(input: Omit<CreateInAppNotificationInput, 'userId'>) {
    const admins = await this.prisma.userPlatformRole.findMany({
      where: { role: UserRole.EKANDA_ADMIN },
      select: { userId: true },
    });
    const uniqueIds = [...new Set(admins.map((item) => item.userId))];
    await this.createMany(uniqueIds.map((userId) => ({ ...input, userId })));
  }

  async listMine(userId: string): Promise<InAppNotificationDto[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => this.present(row));
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  async markRead(id: string, userId: string) {
    const row = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!row) {
      throw new NotFoundException('Notificação não encontrada.');
    }
    if (!row.readAt) {
      await this.prisma.notification.update({
        where: { id },
        data: { readAt: new Date() },
      });
    }
    return { read: true as const };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { read: true as const };
  }

  private buildMetadata(input: CreateInAppNotificationInput) {
    return {
      audience: input.audience,
      source: input.source,
      ...(input.href ? { href: input.href } : {}),
      ...(input.externalUrl ? { externalUrl: input.externalUrl } : {}),
      ...(input.metadata ?? {}),
    };
  }

  async listLegalNotifications(userId: string) {
    const rows = await this.prisma.notification.findMany({
      where: { userId, type: NotificationType.LEGAL },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => {
      const metadata = this.asRecord(row.metadata);
      return {
        id: row.id,
        userId: row.userId,
        schoolId: typeof metadata.schoolId === 'string' ? metadata.schoolId : '',
        title: row.title,
        body: row.message,
        sectionId: typeof metadata.sectionId === 'string' ? metadata.sectionId : 'nif',
        read: Boolean(row.readAt),
        createdAt: row.createdAt.toISOString(),
      };
    });
  }

  async listGestaoNotifications(userId: string) {
    const rows = await this.prisma.notification.findMany({
      where: { userId, type: NotificationType.GESTAO },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => {
      const metadata = this.asRecord(row.metadata);
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

  private asRecord(value: Prisma.JsonValue): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private present(row: {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    readAt: Date | null;
    createdAt: Date;
    metadata: Prisma.JsonValue;
  }): InAppNotificationDto {
    const metadata = this.asRecord(row.metadata);

    const source =
      typeof metadata.source === 'string' && this.isSource(metadata.source)
        ? metadata.source
        : SOURCE_BY_TYPE[row.type];

    const href = typeof metadata.href === 'string' ? metadata.href : this.fallbackHref(row.type, metadata);
    const externalUrl =
      typeof metadata.externalUrl === 'string'
        ? metadata.externalUrl
        : typeof metadata.testUrl === 'string'
          ? metadata.testUrl
          : null;

    return {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.message,
      read: Boolean(row.readAt),
      createdAt: row.createdAt.toISOString(),
      source,
      href,
      externalUrl,
    };
  }

  private fallbackHref(
    type: NotificationType,
    metadata: Record<string, unknown>,
  ): string | null {
    if (type === NotificationType.LEGAL) return '/dashboard/juridico/nif';
    if (type === NotificationType.GESTAO) return '/dashboard/planos';
    if (type === NotificationType.PAYMENT || type === NotificationType.SUBSCRIPTION) {
      return '/dashboard/pagamentos';
    }
    if (type === NotificationType.APPLICATION) {
      return typeof metadata.applicationCode === 'string'
        ? `/encarregado/candidaturas/${metadata.applicationCode}`
        : '/dashboard/candidaturas';
    }
    return null;
  }

  private isSource(value: string): value is NotificationSource {
    return [
      'platform',
      'legal',
      'gestao',
      'candidatura',
      'visita',
      'pagamento',
    ].includes(value);
  }
}
