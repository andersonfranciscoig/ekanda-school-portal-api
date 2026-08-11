import { Injectable } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';
import { UseCase } from '../../../../shared/application/use-case';
import { GetApplicationUseCase } from '../../../application/application/use-cases/get-application.use-case';
import { ListApplicationsUseCase } from '../../../application/application/use-cases/list-applications.use-case';

export type ViewApplicationsInput = {
  status?: ApplicationStatus;
  q?: string;
  schoolId?: string;
  page?: number;
  pageSize?: number;
};

@Injectable()
export class ViewApplicationsUseCase
  implements UseCase<ViewApplicationsInput, unknown>
{
  constructor(
    private readonly listApplications: ListApplicationsUseCase,
    private readonly getApplication: GetApplicationUseCase,
  ) {}

  execute(input: ViewApplicationsInput) {
    return this.listApplications.execute(input);
  }

  getById(applicationId: string) {
    return this.getApplication.execute({ applicationId });
  }
}
