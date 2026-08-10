import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  SchoolPricing,
  SchoolPriceLevelInput,
} from '../../domain/entities/school-pricing.entity';
import {
  DuplicateEducationLevelException,
  EducationLevelNotOfferedBySchoolException,
  InvalidEducationLevelException,
  SchoolPriceAccessDeniedException,
  SchoolPriceNotFoundException,
} from '../../domain/exceptions/school.exceptions';
import {
  SCHOOL_EDUCATION_LEVEL_REPOSITORY,
  SchoolEducationLevelRepository,
} from '../../domain/repositories/school-education-level.repository';
import {
  SCHOOL_PRICE_REPOSITORY,
  SchoolPriceRepository,
} from '../../domain/repositories/school-price.repository';
import {
  EducationLevelCode,
  SCHOOL_PRICES_CURRENCY,
} from '../../domain/school.enums';
import { parseEducationLevelCode } from '../../domain/value-objects/school-catalog.parsers';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';

export type CreateOrUpdateSchoolPriceInput = {
  id?: string;
  schoolId: string;
  levels: Array<{
    levelId: string;
    enrollmentFee?: {
      min?: number | string | null;
      max?: number | string | null;
    };
    tuitionFee?: {
      min?: number | string | null;
      max?: number | string | null;
    };
    transportFee?: {
      min?: number | string | null;
      max?: number | string | null;
    };
    mealFee?: {
      min?: number | string | null;
      max?: number | string | null;
    };
  }>;
  otherFees?: number | string | null;
  currency?: string | null;
  actorUserId: string;
};

export type CreateOrUpdateSchoolPriceOutput = {
  pricing: SchoolPricing;
  operation: 'created' | 'updated';
};

@Injectable()
export class CreateOrUpdateSchoolPriceUseCase
  implements
    UseCase<CreateOrUpdateSchoolPriceInput, CreateOrUpdateSchoolPriceOutput>
{
  constructor(
    @Inject(SCHOOL_PRICE_REPOSITORY)
    private readonly prices: SchoolPriceRepository,
    @Inject(SCHOOL_EDUCATION_LEVEL_REPOSITORY)
    private readonly educationLevels: SchoolEducationLevelRepository,
    private readonly access: SchoolAccessAuthorizer,
  ) {}

  async execute(
    input: CreateOrUpdateSchoolPriceInput,
  ): Promise<CreateOrUpdateSchoolPriceOutput> {
    await this.access.assertSchoolExists(input.schoolId);
    await this.access.assertCanManageSchool(input.actorUserId, input.schoolId);

    const levels = await this.parseAndValidateLevels(
      input.schoolId,
      input.levels,
    );

    if (input.id) {
      return this.update(input, levels);
    }
    return this.create(input, levels);
  }

  private async create(
    input: CreateOrUpdateSchoolPriceInput,
    levels: SchoolPriceLevelInput[],
  ): Promise<CreateOrUpdateSchoolPriceOutput> {
    const existing = await this.prices.findBySchoolId(input.schoolId);
    if (existing) {
      // Upsert: se já existem preços e o cliente não enviou id, actualiza
      return this.update({ ...input, id: existing.id }, levels);
    }

    const pricing = SchoolPricing.create({
      id: crypto.randomUUID(),
      schoolId: input.schoolId,
      levels,
      otherFees: input.otherFees,
      currency: input.currency ?? SCHOOL_PRICES_CURRENCY,
    });

    const persisted = await this.prices.create(pricing);
    return { pricing: persisted, operation: 'created' };
  }

  private async update(
    input: CreateOrUpdateSchoolPriceInput,
    levels: SchoolPriceLevelInput[],
  ): Promise<CreateOrUpdateSchoolPriceOutput> {
    const pricing = await this.prices.findById(input.id!);
    if (!pricing) {
      throw new SchoolPriceNotFoundException();
    }
    if (!pricing.belongsToSchool(input.schoolId)) {
      throw new SchoolPriceAccessDeniedException();
    }

    pricing.update({
      levels,
      otherFees: input.otherFees,
      currency: input.currency ?? SCHOOL_PRICES_CURRENCY,
    });

    const persisted = await this.prices.update(pricing);
    return { pricing: persisted, operation: 'updated' };
  }

  private async parseAndValidateLevels(
    schoolId: string,
    levels: CreateOrUpdateSchoolPriceInput['levels'],
  ): Promise<SchoolPriceLevelInput[]> {
    if (!Array.isArray(levels)) {
      throw new InvalidEducationLevelException('levels must be an array');
    }

    const offered = new Set(
      await this.educationLevels.findBySchoolId(schoolId),
    );
    const seen = new Set<EducationLevelCode>();
    const parsed: SchoolPriceLevelInput[] = [];

    for (const level of levels) {
      let levelId: EducationLevelCode;
      try {
        levelId = parseEducationLevelCode(level.levelId);
      } catch {
        throw new InvalidEducationLevelException(
          `Invalid education level: ${level.levelId}`,
        );
      }

      if (seen.has(levelId)) {
        throw new DuplicateEducationLevelException(
          `Duplicate education level: ${levelId}`,
        );
      }
      seen.add(levelId);

      if (!offered.has(levelId)) {
        throw new EducationLevelNotOfferedBySchoolException(levelId, schoolId);
      }

      parsed.push({
        levelId,
        enrollmentFee: level.enrollmentFee ?? {},
        tuitionFee: level.tuitionFee ?? {},
        transportFee: level.transportFee ?? {},
        mealFee: level.mealFee ?? {},
      });
    }

    return parsed;
  }
}
