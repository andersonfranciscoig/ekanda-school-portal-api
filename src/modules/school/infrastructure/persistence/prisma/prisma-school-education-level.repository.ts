import { Injectable } from '@nestjs/common';
import { EducationLevelCode as PrismaEducationLevelCode } from '@prisma/client';
import { PrismaService } from '../../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { EducationLevelCode } from '../../../domain/school.enums';
import { sortEducationLevels } from '../../../domain/value-objects/school-catalog.parsers';
import { SchoolEducationLevelRepository } from '../../../domain/repositories/school-education-level.repository';

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

@Injectable()
export class PrismaSchoolEducationLevelRepository
  implements SchoolEducationLevelRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findBySchoolId(schoolId: string): Promise<EducationLevelCode[]> {
    const rows = await this.prisma.schoolEducationLevel.findMany({
      where: { schoolId },
      select: { level: true },
    });
    return sortEducationLevels(
      rows.map((row) => PRISMA_TO_DOMAIN[row.level]),
    );
  }

  async sync(
    schoolId: string,
    levels: EducationLevelCode[],
  ): Promise<EducationLevelCode[]> {
    const desired = sortEducationLevels(levels);

    return this.prisma.$transaction(
      async (tx) => {
        const currentRows = await tx.schoolEducationLevel.findMany({
          where: { schoolId },
          select: { level: true },
        });
        const current = new Set(
          currentRows.map((row) => PRISMA_TO_DOMAIN[row.level]),
        );
        const desiredSet = new Set(desired);

        const toRemove = [...current].filter((level) => !desiredSet.has(level));
        const toAdd = desired.filter((level) => !current.has(level));

        if (toRemove.length > 0) {
          await tx.schoolEducationLevel.deleteMany({
            where: {
              schoolId,
              level: { in: toRemove.map((level) => DOMAIN_TO_PRISMA[level]) },
            },
          });
        }

        if (toAdd.length > 0) {
          await tx.schoolEducationLevel.createMany({
            data: toAdd.map((level) => ({
              id: crypto.randomUUID(),
              schoolId,
              level: DOMAIN_TO_PRISMA[level],
            })),
          });
        }

        return desired;
      },
      { maxWait: 10000, timeout: 20000 },
    );
  }
}
