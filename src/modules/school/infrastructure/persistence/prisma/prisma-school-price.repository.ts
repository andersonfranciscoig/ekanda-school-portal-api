import { Injectable } from '@nestjs/common';
import {
  EducationLevelCode as PrismaEducationLevelCode,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { SchoolPricing } from '../../../domain/entities/school-pricing.entity';
import { SchoolPriceRepository } from '../../../domain/repositories/school-price.repository';
import {
  EducationLevelCode,
  SCHOOL_PRICES_CURRENCY,
} from '../../../domain/school.enums';
import { sortEducationLevels } from '../../../domain/value-objects/school-catalog.parsers';

const DOMAIN_TO_PRISMA: Record<EducationLevelCode, PrismaEducationLevelCode> = {
  [EducationLevelCode.CRECHE]: PrismaEducationLevelCode.CRECHE,
  [EducationLevelCode.PRE_ESCOLAR]: PrismaEducationLevelCode.PRE_ESCOLAR,
  [EducationLevelCode.PRIMARIO]: PrismaEducationLevelCode.PRIMARIO,
  [EducationLevelCode.I_CICLO]: PrismaEducationLevelCode.I_CICLO,
  [EducationLevelCode.II_CICLO]: PrismaEducationLevelCode.II_CICLO,
  [EducationLevelCode.MEDIO]: PrismaEducationLevelCode.MEDIO,
};

const PRISMA_TO_DOMAIN: Record<PrismaEducationLevelCode, EducationLevelCode> = {
  [PrismaEducationLevelCode.CRECHE]: EducationLevelCode.CRECHE,
  [PrismaEducationLevelCode.PRE_ESCOLAR]: EducationLevelCode.PRE_ESCOLAR,
  [PrismaEducationLevelCode.PRIMARIO]: EducationLevelCode.PRIMARIO,
  [PrismaEducationLevelCode.I_CICLO]: EducationLevelCode.I_CICLO,
  [PrismaEducationLevelCode.II_CICLO]: EducationLevelCode.II_CICLO,
  [PrismaEducationLevelCode.MEDIO]: EducationLevelCode.MEDIO,
};

type PriceRecord = {
  id: string;
  schoolId: string;
  otherFees: Prisma.Decimal | number | null;
  currency: string;
  levels: Array<{
    levelId: PrismaEducationLevelCode;
    enrollmentFeeMin: Prisma.Decimal | number | null;
    enrollmentFeeMax: Prisma.Decimal | number | null;
    tuitionFeeMin: Prisma.Decimal | number | null;
    tuitionFeeMax: Prisma.Decimal | number | null;
    transportFeeMin: Prisma.Decimal | number | null;
    transportFeeMax: Prisma.Decimal | number | null;
    mealFeeMin: Prisma.Decimal | number | null;
    mealFeeMax: Prisma.Decimal | number | null;
  }>;
};

@Injectable()
export class PrismaSchoolPriceRepository implements SchoolPriceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<SchoolPricing | null> {
    const record = await this.prisma.schoolPrice.findUnique({
      where: { id },
      include: { levels: true },
    });
    return record ? this.toDomain(record) : null;
  }

  async findBySchoolId(schoolId: string): Promise<SchoolPricing | null> {
    const record = await this.prisma.schoolPrice.findUnique({
      where: { schoolId },
      include: { levels: true },
    });
    return record ? this.toDomain(record) : null;
  }

  async create(pricing: SchoolPricing): Promise<SchoolPricing> {
    const snap = pricing.toSnapshot();

    const record = await this.prisma.$transaction(async (tx) => {
      await tx.schoolPrice.create({
        data: {
          id: snap.id,
          schoolId: snap.schoolId,
          otherFees: snap.otherFees,
          currency: snap.currency,
          levels: {
            create: snap.levels.map((level) => ({
              id: crypto.randomUUID(),
              levelId: DOMAIN_TO_PRISMA[level.levelId],
              enrollmentFeeMin: level.enrollmentFee.min,
              enrollmentFeeMax: level.enrollmentFee.max,
              tuitionFeeMin: level.tuitionFee.min,
              tuitionFeeMax: level.tuitionFee.max,
              transportFeeMin: level.transportFee.min,
              transportFeeMax: level.transportFee.max,
              mealFeeMin: level.mealFee.min,
              mealFeeMax: level.mealFee.max,
            })),
          },
        },
      });

      return tx.schoolPrice.findUniqueOrThrow({
        where: { id: snap.id },
        include: { levels: true },
      });
    });

    return this.toDomain(record);
  }

  async update(pricing: SchoolPricing): Promise<SchoolPricing> {
    const snap = pricing.toSnapshot();

    const record = await this.prisma.$transaction(async (tx) => {
      await tx.schoolPrice.update({
        where: { id: snap.id },
        data: {
          otherFees: snap.otherFees,
          currency: snap.currency,
        },
      });

      await tx.schoolPriceLevel.deleteMany({
        where: { schoolPriceId: snap.id },
      });

      if (snap.levels.length > 0) {
        await tx.schoolPriceLevel.createMany({
          data: snap.levels.map((level) => ({
            id: crypto.randomUUID(),
            schoolPriceId: snap.id,
            levelId: DOMAIN_TO_PRISMA[level.levelId],
            enrollmentFeeMin: level.enrollmentFee.min,
            enrollmentFeeMax: level.enrollmentFee.max,
            tuitionFeeMin: level.tuitionFee.min,
            tuitionFeeMax: level.tuitionFee.max,
            transportFeeMin: level.transportFee.min,
            transportFeeMax: level.transportFee.max,
            mealFeeMin: level.mealFee.min,
            mealFeeMax: level.mealFee.max,
          })),
        });
      }

      return tx.schoolPrice.findUniqueOrThrow({
        where: { id: snap.id },
        include: { levels: true },
      });
    });

    return this.toDomain(record);
  }

  private toDomain(record: PriceRecord): SchoolPricing {
    const toNumber = (
      value: Prisma.Decimal | number | null,
    ): number | null => {
      if (value == null) return null;
      return typeof value === 'number' ? value : value.toNumber();
    };

    const levels = sortEducationLevels(
      record.levels.map((level) => PRISMA_TO_DOMAIN[level.levelId]),
    ).map((levelId) => {
      const row = record.levels.find(
        (level) => PRISMA_TO_DOMAIN[level.levelId] === levelId,
      )!;
      return {
        levelId,
        enrollmentFee: {
          min: toNumber(row.enrollmentFeeMin),
          max: toNumber(row.enrollmentFeeMax),
        },
        tuitionFee: {
          min: toNumber(row.tuitionFeeMin),
          max: toNumber(row.tuitionFeeMax),
        },
        transportFee: {
          min: toNumber(row.transportFeeMin),
          max: toNumber(row.transportFeeMax),
        },
        mealFee: {
          min: toNumber(row.mealFeeMin),
          max: toNumber(row.mealFeeMax),
        },
      };
    });

    return SchoolPricing.rehydrate({
      id: record.id,
      schoolId: record.schoolId,
      levels,
      otherFees: toNumber(record.otherFees),
      currency: (record.currency as typeof SCHOOL_PRICES_CURRENCY) || SCHOOL_PRICES_CURRENCY,
    });
  }
}
