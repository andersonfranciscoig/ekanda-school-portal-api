import { Injectable } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';
import { UseCase } from '../../../../shared/application/use-case';
import {
  BusinessRuleViolationException,
  EntityNotFoundException,
} from '../../../../shared/domain/exceptions/domain.exception';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { SchoolAccessAuthorizer } from '../../../school/application/services/school-access.authorizer';
import {
  applicationDetailInclude,
  applicationCode,
  DECIDABLE_APPLICATION_STATUSES,
  presentApplicationDetail,
} from '../services/application.presenter';
import { MailService } from '../../../mail/application/mail.service';

export type RejectApplicationInput = {
  actorUserId: string;
  schoolId: string;
  applicationId: string;
  reason: string;
};

@Injectable()
export class RejectApplicationUseCase
  implements UseCase<RejectApplicationInput, unknown>
{
  constructor(
    private readonly access: SchoolAccessAuthorizer,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async execute(input: RejectApplicationInput) {
    const reason = input.reason.trim();
    if (reason.length < 5) {
      throw new BusinessRuleViolationException(
        'Rejection reason must have at least 5 characters',
      );
    }

    await this.access.assertCanManageSchool(input.actorUserId, input.schoolId);

    const application = await this.prisma.application.findFirst({
      where: { id: input.applicationId, schoolId: input.schoolId },
    });
    if (!application) throw new EntityNotFoundException('Application not found');
    if (!DECIDABLE_APPLICATION_STATUSES.includes(application.status)) {
      throw new BusinessRuleViolationException(
        `Application cannot be rejected from status ${application.status}`,
      );
    }

    await this.prisma.application.update({
      where: { id: application.id },
      data: {
        status: ApplicationStatus.REJECTED,
        reviewedAt: new Date(),
        notes: application.notes,
        statusHistory: {
          create: {
            id: crypto.randomUUID(),
            fromStatus: application.status,
            toStatus: ApplicationStatus.REJECTED,
            changedByUserId: input.actorUserId,
            reason,
          },
        },
      },
    });

    const detail = await this.prisma.application.findUniqueOrThrow({
      where: { id: application.id },
      include: applicationDetailInclude,
    });

    const code = applicationCode(detail.id);
    const studentName = `${detail.student.firstName} ${detail.student.lastName}`.trim();
    const guardianName = `${detail.guardian.firstName} ${detail.guardian.lastName}`.trim();
    this.mail.sendApplicationRejected({
      email: detail.guardian.email,
      guardianName,
      studentName,
      schoolName: detail.school.name,
      applicationCode: code,
      reason,
    });

    return presentApplicationDetail(detail);
  }
}
