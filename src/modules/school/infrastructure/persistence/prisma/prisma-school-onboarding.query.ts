import { Injectable } from '@nestjs/common';
import {
  EducationLevelCode as PrismaEducationLevelCode,
  GalleryKind as PrismaGalleryKind,
  Prisma,
  SchoolStatus as PrismaSchoolStatus,
} from '@prisma/client';
import { PrismaService } from '../../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { SchoolOnboardingQuery } from '../../../domain/repositories/school-onboarding.query';
import {
  EducationLevelCode,
  GalleryKind,
  SchoolStatus,
} from '../../../domain/school.enums';
import { SchoolOnboardingSnapshot } from '../../../domain/services/school-onboarding.evaluator';

const LEVEL_MAP: Record<PrismaEducationLevelCode, EducationLevelCode> = {
  [PrismaEducationLevelCode.CRECHE]: EducationLevelCode.CRECHE,
  [PrismaEducationLevelCode.PRE_ESCOLAR]: EducationLevelCode.PRE_ESCOLAR,
  [PrismaEducationLevelCode.PRIMARIO]: EducationLevelCode.PRIMARIO,
  [PrismaEducationLevelCode.I_CICLO]: EducationLevelCode.I_CICLO,
  [PrismaEducationLevelCode.II_CICLO]: EducationLevelCode.II_CICLO,
  [PrismaEducationLevelCode.MEDIO]: EducationLevelCode.MEDIO,
};

const STATUS_MAP: Record<PrismaSchoolStatus, SchoolStatus> = {
  [PrismaSchoolStatus.DRAFT]: SchoolStatus.DRAFT,
  [PrismaSchoolStatus.PENDING_PAYMENT]: SchoolStatus.PENDING_PAYMENT,
  [PrismaSchoolStatus.PENDING_REVIEW]: SchoolStatus.PENDING_REVIEW,
  [PrismaSchoolStatus.ACTIVE]: SchoolStatus.ACTIVE,
  [PrismaSchoolStatus.SUSPENDED]: SchoolStatus.SUSPENDED,
  [PrismaSchoolStatus.EXPIRED]: SchoolStatus.EXPIRED,
  [PrismaSchoolStatus.REJECTED]: SchoolStatus.REJECTED,
};

@Injectable()
export class PrismaSchoolOnboardingQuery implements SchoolOnboardingQuery {
  constructor(private readonly prisma: PrismaService) {}

  async findSnapshot(
    schoolId: string,
  ): Promise<SchoolOnboardingSnapshot | null> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      include: {
        location: true,
        educationLevels: { select: { level: true } },
        classes: {
          select: {
            classLabel: true,
            vacancies: true,
            shift: true,
            isActive: true,
          },
        },
        price: {
          include: {
            levels: {
              select: {
                levelId: true,
                tuitionFeeMin: true,
                tuitionFeeMax: true,
              },
            },
          },
        },
        gallery: { select: { kind: true } },
      },
    });

    if (!school) return null;

    const toNumber = (
      value: Prisma.Decimal | number | null,
    ): number | null => {
      if (value == null) return null;
      return typeof value === 'number' ? value : value.toNumber();
    };

    return {
      schoolId: school.id,
      status: STATUS_MAP[school.status],
      name: school.name,
      description: school.description,
      servicesConfiguredAt: school.servicesConfiguredAt,
      location: school.location
        ? {
            province: school.location.province,
            municipality: school.location.municipality,
          }
        : null,
      educationLevels: school.educationLevels.map(
        (row) => LEVEL_MAP[row.level],
      ),
      classes: school.classes.map((c) => ({
        classLabel: c.classLabel,
        vacancies: c.vacancies,
        shift: c.shift,
      })),
      price: school.price
        ? {
            currency: school.price.currency,
            levels: school.price.levels.map((level) => ({
              levelId: LEVEL_MAP[level.levelId],
              tuitionFeeMin: toNumber(level.tuitionFeeMin),
              tuitionFeeMax: toNumber(level.tuitionFeeMax),
            })),
          }
        : null,
      gallery: school.gallery.map((g) => ({
        kind:
          g.kind === PrismaGalleryKind.VIDEO
            ? GalleryKind.VIDEO
            : GalleryKind.PHOTO,
      })),
    };
  }
}
