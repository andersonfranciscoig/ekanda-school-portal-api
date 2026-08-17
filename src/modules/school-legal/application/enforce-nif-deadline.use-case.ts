import { Inject, Injectable, Logger } from '@nestjs/common';
import { NotificationType, SchoolNifStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { UseCase } from '../../../shared/application/use-case';
import {
  AUDIT_LOGGER,
  type AuditLogger,
} from '../../../shared/application/ports/audit-logger.port';
import { PrismaService } from '../../../shared/infrastructure/persistence/prisma/prisma.service';
import { MailRecipientsService } from '../../mail/application/mail-recipients.service';
import { MailService } from '../../mail/application/mail.service';
import { SchoolStatus } from '../../school/domain/school.enums';
import {
  SCHOOL_REPOSITORY,
  SchoolRepository,
} from '../../school/domain/repositories/school.repository';
import {
  SUBSCRIPTION_REPOSITORY,
  SubscriptionRepository,
} from '../../billing/domain/repositories/billing.repositories';
import {
  daysRemainingUntil,
  LEGAL_SECTION_NIF,
  NIF_DEADLINE_SUSPEND_REASON,
  NIF_REMINDER_DAYS_REMAINING,
  needsNifSubmission,
} from './school-legal.constants';

export type EnforceNifDeadlineInput = {
  now?: Date;
};

export type EnforceNifDeadlineOutput = {
  remindersSent: number;
  suspended: number;
};

@Injectable()
export class EnforceNifDeadlineUseCase
  implements UseCase<EnforceNifDeadlineInput, EnforceNifDeadlineOutput>
{
  private readonly logger = new Logger(EnforceNifDeadlineUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SCHOOL_REPOSITORY)
    private readonly schools: SchoolRepository,
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepository,
    @Inject(AUDIT_LOGGER)
    private readonly audit: AuditLogger,
    private readonly mail: MailService,
    private readonly recipients: MailRecipientsService,
  ) {}

  async execute(input: EnforceNifDeadlineInput = {}): Promise<EnforceNifDeadlineOutput> {
    const now = input.now ?? new Date();
    const remindersSent = await this.sendDueReminders(now);
    const suspended = await this.suspendOverdueSchools(now);

    if (remindersSent || suspended) {
      this.logger.log(
        `NIF deadline: ${remindersSent} reminder(s), ${suspended} suspended`,
      );
    }

    return { remindersSent, suspended };
  }

  private async sendDueReminders(now: Date): Promise<number> {
    const profiles = await this.prisma.schoolLegalProfile.findMany({
      where: {
        nifDeadlineAt: { not: null },
        nifReminderSentAt: null,
        nifStatus: { in: [SchoolNifStatus.NOT_SUBMITTED, SchoolNifStatus.REJECTED] },
        school: { status: 'ACTIVE' },
      },
      include: {
        school: { select: { id: true, name: true } },
      },
    });

    let sent = 0;

    for (const profile of profiles) {
      if (!profile.nifDeadlineAt) continue;
      const days = daysRemainingUntil(profile.nifDeadlineAt, now);
      if (days !== NIF_REMINDER_DAYS_REMAINING) continue;

      const membership = await this.prisma.schoolMembership.findFirst({
        where: {
          schoolId: profile.schoolId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
        include: { user: true },
        orderBy: { createdAt: 'asc' },
      });
      const ownerUser = membership?.user;
      if (!ownerUser?.email) continue;

      this.mail.sendSchoolNifDeadlineReminder({
        email: ownerUser.email,
        ownerName: ownerUser.firstName?.trim() || ownerUser.email,
        schoolName: profile.school.name,
        daysRemaining: days,
        deadlineAt: profile.nifDeadlineAt,
      });

      const unread =
        profile.sectionUnread &&
        typeof profile.sectionUnread === 'object' &&
        !Array.isArray(profile.sectionUnread)
          ? { ...(profile.sectionUnread as Record<string, boolean>) }
          : {};
      unread[LEGAL_SECTION_NIF.id] = true;

      await this.prisma.$transaction([
        this.prisma.schoolLegalProfile.update({
          where: { schoolId: profile.schoolId },
          data: {
            nifReminderSentAt: now,
            sectionUnread: unread as Prisma.InputJsonValue,
          },
        }),
        this.prisma.notification.create({
          data: {
            id: randomUUID(),
            userId: ownerUser.id,
            type: NotificationType.LEGAL,
            title: 'Prazo NIF — faltam 3 dias',
            message: `Submeta o NIF de ${profile.school.name} na área Jurídica até ${profile.nifDeadlineAt.toLocaleDateString('pt-AO')} para evitar a suspensão do colégio.`,
            metadata: {
              schoolId: profile.schoolId,
              sectionId: LEGAL_SECTION_NIF.id,
              daysRemaining: days,
            },
          },
        }),
      ]);

      sent += 1;
    }

    return sent;
  }

  private async suspendOverdueSchools(now: Date): Promise<number> {
    const profiles = await this.prisma.schoolLegalProfile.findMany({
      where: {
        nifDeadlineAt: { lt: now },
        nifStatus: { in: [SchoolNifStatus.NOT_SUBMITTED, SchoolNifStatus.REJECTED] },
        school: { status: 'ACTIVE' },
      },
      include: {
        school: { select: { id: true, name: true } },
      },
    });

    let suspended = 0;

    for (const profile of profiles) {
      const school = await this.schools.findById(profile.schoolId);
      if (!school || school.status !== SchoolStatus.ACTIVE) continue;

      await this.closeActiveSubscriptions(profile.schoolId);

      school.suspend(NIF_DEADLINE_SUSPEND_REASON);
      await this.schools.save(school);
      suspended += 1;

      await this.audit.log({
        action: 'SCHOOL_STATUS_CHANGED',
        entity: 'SCHOOL',
        entityId: school.id,
        oldData: { status: SchoolStatus.ACTIVE },
        newData: { status: SchoolStatus.SUSPENDED },
        metadata: {
          from: SchoolStatus.ACTIVE,
          to: SchoolStatus.SUSPENDED,
          reason: NIF_DEADLINE_SUSPEND_REASON,
          entityLabel: profile.school.name,
          source: 'NIF_DEADLINE_CRON',
        },
      });

      await this.audit.log({
        action: 'NIF_DEADLINE_EXPIRED',
        entity: 'SCHOOL_LEGAL',
        entityId: profile.schoolId,
        metadata: {
          entityLabel: profile.school.name,
          nifDeadlineAt: profile.nifDeadlineAt?.toISOString() ?? null,
        },
      });

      const owner = await this.recipients.schoolOwner(profile.schoolId);
      if (owner) {
        this.mail.sendSchoolStatusChanged({
          email: owner.email,
          ownerName: owner.name,
          schoolName: profile.school.name,
          statusLabel: 'Suspenso',
          reason: NIF_DEADLINE_SUSPEND_REASON,
        });
      }
    }

    return suspended;
  }

  private async closeActiveSubscriptions(schoolId: string) {
    const existing = await this.subscriptions.findManyBySchoolId(schoolId);
    for (const subscription of existing) {
      if (subscription.status !== 'ACTIVE') continue;
      subscription.expire();
      await this.subscriptions.save(subscription);
    }
  }
}
