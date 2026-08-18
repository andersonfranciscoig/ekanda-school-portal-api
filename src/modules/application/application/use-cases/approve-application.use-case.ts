import { Injectable } from '@nestjs/common';
import { ApplicationStatus, NotificationType } from '@prisma/client';
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
import { InAppNotificationService } from '../../../notification/application/in-app-notification.service';

export type ApproveApplicationInput = {
  actorUserId: string;
  schoolId: string;
  applicationId: string;
};

@Injectable()
export class ApproveApplicationUseCase
  implements UseCase<ApproveApplicationInput, unknown>
{
  constructor(
    private readonly access: SchoolAccessAuthorizer,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly notifications: InAppNotificationService,
  ) {}

  async execute(input: ApproveApplicationInput) {
    await this.access.assertCanManageSchool(input.actorUserId, input.schoolId);

    const application = await this.prisma.application.findFirst({
      where: { id: input.applicationId, schoolId: input.schoolId },
    });
    if (!application) throw new EntityNotFoundException('Application not found');
    if (!DECIDABLE_APPLICATION_STATUSES.includes(application.status)) {
      throw new BusinessRuleViolationException(
        `Application cannot be accepted from status ${application.status}`,
      );
    }

    await this.prisma.application.update({
      where: { id: application.id },
      data: {
        status: ApplicationStatus.ACCEPTED,
        reviewedAt: new Date(),
        statusHistory: {
          create: {
            id: crypto.randomUUID(),
            fromStatus: application.status,
            toStatus: ApplicationStatus.ACCEPTED,
            changedByUserId: input.actorUserId,
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
    this.mail.sendApplicationAccepted({
      email: detail.guardian.email,
      guardianName,
      studentName,
      schoolName: detail.school.name,
      applicationCode: code,
    });

    await this.notifications.create({
      userId: detail.guardianId,
      type: NotificationType.APPLICATION,
      audience: 'guardian',
      source: 'candidatura',
      title: 'Candidatura aceite',
      message: `A candidatura ${code} de ${studentName} em ${detail.school.name} foi aceite.`,
      href: `/encarregado/candidaturas/${code}`,
      metadata: { applicationId: detail.id, applicationCode: code },
    });

    return presentApplicationDetail(detail);
  }
}
