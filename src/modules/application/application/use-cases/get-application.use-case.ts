import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/domain.exception';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import {
  applicationDetailInclude,
  presentApplicationDetail,
} from '../services/application.presenter';

export type GetApplicationInput = {
  applicationId: string;
  schoolId?: string;
};

@Injectable()
export class GetApplicationUseCase
  implements UseCase<GetApplicationInput, unknown>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: GetApplicationInput) {
    const application = await this.prisma.application.findFirst({
      where: {
        id: input.applicationId,
        ...(input.schoolId ? { schoolId: input.schoolId } : {}),
      },
      include: applicationDetailInclude,
    });
    if (!application) throw new EntityNotFoundException('Application not found');
    return presentApplicationDetail(application);
  }
}
