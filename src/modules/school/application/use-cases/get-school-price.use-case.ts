import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { SchoolPricing } from '../../domain/entities/school-pricing.entity';
import { SchoolPriceNotFoundException } from '../../domain/exceptions/school.exceptions';
import {
  SCHOOL_PRICE_REPOSITORY,
  SchoolPriceRepository,
} from '../../domain/repositories/school-price.repository';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';

export type GetSchoolPriceInput = {
  schoolId: string;
  actorUserId: string;
};

@Injectable()
export class GetSchoolPriceUseCase
  implements UseCase<GetSchoolPriceInput, SchoolPricing>
{
  constructor(
    @Inject(SCHOOL_PRICE_REPOSITORY)
    private readonly prices: SchoolPriceRepository,
    private readonly access: SchoolAccessAuthorizer,
  ) {}

  async execute(input: GetSchoolPriceInput): Promise<SchoolPricing> {
    await this.access.assertSchoolExists(input.schoolId);
    await this.access.assertCanManageSchool(input.actorUserId, input.schoolId);

    const pricing = await this.prices.findBySchoolId(input.schoolId);
    if (!pricing) {
      throw new SchoolPriceNotFoundException();
    }
    return pricing;
  }
}
