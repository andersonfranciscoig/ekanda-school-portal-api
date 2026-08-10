import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  AUDIT_LOGGER,
  AuditLogger,
} from '../../../../shared/application/ports/audit-logger.port';
import { SchoolPriceNotFoundException } from '../../domain/exceptions/school.exceptions';
import {
  SCHOOL_PRICE_REPOSITORY,
  SchoolPriceRepository,
} from '../../domain/repositories/school-price.repository';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';

export type DeleteSchoolPriceInput = {
  schoolId: string;
  actorUserId: string;
};

export type DeleteSchoolPriceOutput = {
  schoolId: string;
  deleted: true;
};

@Injectable()
export class DeleteSchoolPriceUseCase
  implements UseCase<DeleteSchoolPriceInput, DeleteSchoolPriceOutput>
{
  constructor(
    @Inject(SCHOOL_PRICE_REPOSITORY)
    private readonly prices: SchoolPriceRepository,
    private readonly access: SchoolAccessAuthorizer,
    @Inject(AUDIT_LOGGER)
    private readonly audit: AuditLogger,
  ) {}

  async execute(
    input: DeleteSchoolPriceInput,
  ): Promise<DeleteSchoolPriceOutput> {
    await this.access.assertSchoolExists(input.schoolId);
    await this.access.assertCanManageSchool(input.actorUserId, input.schoolId);

    const pricing = await this.prices.findBySchoolId(input.schoolId);
    if (!pricing) {
      throw new SchoolPriceNotFoundException();
    }

    const oldData = pricing.toSnapshot();
    const deleted = await this.prices.deleteBySchoolId(input.schoolId);
    if (!deleted) {
      throw new SchoolPriceNotFoundException();
    }

    await this.audit.log({
      actorUserId: input.actorUserId,
      action: 'SCHOOL_PRICES_DELETED',
      entity: 'SchoolPrice',
      entityId: pricing.id,
      oldData,
      newData: null,
      metadata: { schoolId: input.schoolId },
    });

    return { schoolId: input.schoolId, deleted: true };
  }
}
