import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { AUDIT_LOGGER } from '../../../../shared/application/ports/audit-logger.port';
import type { AuditLogger } from '../../../../shared/application/ports/audit-logger.port';
import { BusinessRuleViolationException } from '../../../../shared/domain/exceptions/domain.exception';
import {
  PLAN_REPOSITORY,
  PlanRepository,
  SUBSCRIPTION_REPOSITORY,
  SubscriptionRepository,
} from '../../../billing/domain/repositories/billing.repositories';
import { Subscription } from '../../../billing/domain/aggregates/subscription.aggregate';
import { PlanNotFoundException } from '../../../billing/domain/exceptions/billing.exceptions';
import { SchoolNotFoundException } from '../../../school/domain/exceptions/school.exceptions';
import {
  SCHOOL_REPOSITORY,
  SchoolRepository,
} from '../../../school/domain/repositories/school.repository';
import { SchoolStatus } from '../../../school/domain/school.enums';
import { MailService } from '../../../mail/application/mail.service';
import { MailRecipientsService } from '../../../mail/application/mail-recipients.service';

const STATUS_LABEL: Partial<Record<SchoolStatus, string>> = {
  [SchoolStatus.SUSPENDED]: 'Suspenso',
  [SchoolStatus.EXPIRED]: 'Plano expirado',
  [SchoolStatus.ACTIVE]: 'Activo',
  [SchoolStatus.REJECTED]: 'Rejeitado',
  [SchoolStatus.PENDING_REVIEW]: 'Em análise',
};

export type ChangeSchoolStatusInput = {
  schoolId: string;
  actorUserId: string;
  status: SchoolStatus;
  reason?: string | null;
  planId?: string | null;
  durationDays?: number | null;
  endsAt?: string | Date | null;
};

export type ChangeSchoolStatusOutput = {
  schoolId: string;
  status: SchoolStatus;
  subscription: {
    id: string;
    planId: string;
    planCode: string;
    planName: string;
    startDate: string | null;
    endDate: string | null;
    status: string;
  } | null;
};

@Injectable()
export class ChangeSchoolStatusUseCase
  implements UseCase<ChangeSchoolStatusInput, ChangeSchoolStatusOutput>
{
  constructor(
    @Inject(SCHOOL_REPOSITORY)
    private readonly schools: SchoolRepository,
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepository,
    @Inject(PLAN_REPOSITORY)
    private readonly plans: PlanRepository,
    @Inject(AUDIT_LOGGER)
    private readonly audit: AuditLogger,
    private readonly mail: MailService,
    private readonly recipients: MailRecipientsService,
  ) {}

  async execute(input: ChangeSchoolStatusInput): Promise<ChangeSchoolStatusOutput> {
    const school = await this.schools.findById(input.schoolId);
    if (!school) throw new SchoolNotFoundException();

    const from = school.status;
    const to = input.status;
    const reason = input.reason?.trim() || null;

    if (to === SchoolStatus.SUSPENDED || to === SchoolStatus.REJECTED) {
      if (!reason || reason.length < 5) {
        throw new BusinessRuleViolationException(
          'Reason is required (min 5 characters) when suspending or rejecting',
        );
      }
    }

    let grant: Subscription | null = null;
    let planCode = '';
    let planName = '';

    if (to === SchoolStatus.ACTIVE) {
      const period = this.resolveGrantPeriod(input);
      if (!input.planId) {
        throw new BusinessRuleViolationException(
          'planId is required when activating a school',
        );
      }
      const plan = await this.plans.findById(input.planId);
      if (!plan) throw new PlanNotFoundException();
      plan.assertActive();
      planCode = plan.code;
      planName = plan.name;

      await this.closeActiveSubscriptions(school.id);
      grant = Subscription.createAdminGrant({
        id: crypto.randomUUID(),
        schoolId: school.id,
        planId: plan.id,
        startDate: period.startDate,
        endDate: period.endDate,
      });
      await this.subscriptions.save(grant);
    } else if (from === SchoolStatus.ACTIVE) {
      await this.closeActiveSubscriptions(school.id);
    }

    school.applyAdminStatus({
      status: to,
      actorUserId: input.actorUserId,
      reason,
    });
    await this.schools.save(school);

    await this.audit.log({
      actorUserId: input.actorUserId,
      action: 'SCHOOL_STATUS_CHANGED',
      entity: 'SCHOOL',
      entityId: school.id,
      oldData: { status: from },
      newData: { status: to },
      metadata: {
        from,
        to,
        planId: grant?.planId ?? null,
        reason,
        entityLabel: school.name,
        source: grant ? 'ADMIN_GRANT' : null,
      },
    });

    if (grant) {
      await this.audit.log({
        actorUserId: input.actorUserId,
        action: 'ADMIN_PLAN_GRANTED',
        entity: 'SUBSCRIPTION',
        entityId: grant.id,
        metadata: {
          schoolId: school.id,
          planId: grant.planId,
          planCode,
          entityLabel: school.name,
          source: 'ADMIN_GRANT',
        },
      });
    }

    if (
      to === SchoolStatus.SUSPENDED ||
      to === SchoolStatus.EXPIRED ||
      (to !== from && to !== SchoolStatus.ACTIVE)
    ) {
      const owner = await this.recipients.schoolOwner(school.id);
      if (owner) {
        this.mail.sendSchoolStatusChanged({
          email: owner.email,
          ownerName: owner.name,
          schoolName: school.name,
          statusLabel: STATUS_LABEL[to] ?? to,
          reason,
        });
      }
    }

    return {
      schoolId: school.id,
      status: school.status,
      subscription: grant
        ? {
            id: grant.id,
            planId: grant.planId,
            planCode,
            planName,
            startDate: grant.startDate?.toISOString() ?? null,
            endDate: grant.endDate?.toISOString() ?? null,
            status: grant.status,
          }
        : null,
    };
  }

  private resolveGrantPeriod(input: ChangeSchoolStatusInput) {
    const startDate = new Date();
    if (input.endsAt) {
      const endDate = new Date(input.endsAt);
      if (Number.isNaN(endDate.getTime()) || endDate <= startDate) {
        throw new BusinessRuleViolationException(
          'endsAt must be a future date',
        );
      }
      return { startDate, endDate };
    }
    const days = Number(input.durationDays);
    if (!Number.isInteger(days) || days <= 0) {
      throw new BusinessRuleViolationException(
        'durationDays or a future endsAt is required when activating',
      );
    }
    const endDate = new Date(startDate.getTime());
    endDate.setUTCDate(endDate.getUTCDate() + days);
    return { startDate, endDate };
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
