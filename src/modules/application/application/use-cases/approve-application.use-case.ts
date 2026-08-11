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
  DECIDABLE_APPLICATION_STATUSES,
  presentApplicationDetail,
} from '../services/application.presenter';

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
    return presentApplicationDetail(detail);
  }
}
