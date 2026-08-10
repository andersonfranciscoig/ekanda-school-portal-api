import { Injectable } from '@nestjs/common';
import { SchoolServiceCatalogId as PrismaSchoolServiceCatalogId } from '@prisma/client';
import { PrismaService } from '../../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { SchoolServiceCatalogId } from '../../../domain/school.enums';
import { sortSchoolServices } from '../../../domain/value-objects/school-catalog.parsers';
import { SchoolServiceRepository } from '../../../domain/repositories/school-service.repository';

const DOMAIN_TO_PRISMA: Record<
  SchoolServiceCatalogId,
  PrismaSchoolServiceCatalogId
> = {
  [SchoolServiceCatalogId.TRANSPORTE]: PrismaSchoolServiceCatalogId.TRANSPORTE,
  [SchoolServiceCatalogId.CANTINA]: PrismaSchoolServiceCatalogId.CANTINA,
  [SchoolServiceCatalogId.BIBLIOTECA]: PrismaSchoolServiceCatalogId.BIBLIOTECA,
  [SchoolServiceCatalogId.LABORATORIO]:
    PrismaSchoolServiceCatalogId.LABORATORIO,
  [SchoolServiceCatalogId.CAMPO]: PrismaSchoolServiceCatalogId.CAMPO,
  [SchoolServiceCatalogId.INFORMATICA]:
    PrismaSchoolServiceCatalogId.INFORMATICA,
  [SchoolServiceCatalogId.INGLES]: PrismaSchoolServiceCatalogId.INGLES,
  [SchoolServiceCatalogId.SEGURANCA]: PrismaSchoolServiceCatalogId.SEGURANCA,
  [SchoolServiceCatalogId.ENFERMARIA]: PrismaSchoolServiceCatalogId.ENFERMARIA,
  [SchoolServiceCatalogId.EXTRA]: PrismaSchoolServiceCatalogId.EXTRA,
};

const PRISMA_TO_DOMAIN: Record<
  PrismaSchoolServiceCatalogId,
  SchoolServiceCatalogId
> = {
  [PrismaSchoolServiceCatalogId.TRANSPORTE]: SchoolServiceCatalogId.TRANSPORTE,
  [PrismaSchoolServiceCatalogId.CANTINA]: SchoolServiceCatalogId.CANTINA,
  [PrismaSchoolServiceCatalogId.BIBLIOTECA]: SchoolServiceCatalogId.BIBLIOTECA,
  [PrismaSchoolServiceCatalogId.LABORATORIO]:
    SchoolServiceCatalogId.LABORATORIO,
  [PrismaSchoolServiceCatalogId.CAMPO]: SchoolServiceCatalogId.CAMPO,
  [PrismaSchoolServiceCatalogId.INFORMATICA]:
    SchoolServiceCatalogId.INFORMATICA,
  [PrismaSchoolServiceCatalogId.INGLES]: SchoolServiceCatalogId.INGLES,
  [PrismaSchoolServiceCatalogId.SEGURANCA]: SchoolServiceCatalogId.SEGURANCA,
  [PrismaSchoolServiceCatalogId.ENFERMARIA]: SchoolServiceCatalogId.ENFERMARIA,
  [PrismaSchoolServiceCatalogId.EXTRA]: SchoolServiceCatalogId.EXTRA,
};

@Injectable()
export class PrismaSchoolServiceRepository implements SchoolServiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBySchoolId(schoolId: string): Promise<SchoolServiceCatalogId[]> {
    const rows = await this.prisma.schoolService.findMany({
      where: { schoolId },
      select: { serviceId: true },
    });
    return sortSchoolServices(
      rows.map((row) => PRISMA_TO_DOMAIN[row.serviceId]),
    );
  }

  async sync(
    schoolId: string,
    serviceIds: SchoolServiceCatalogId[],
  ): Promise<SchoolServiceCatalogId[]> {
    const desired = sortSchoolServices(serviceIds);

    return this.prisma.$transaction(
      async (tx) => {
        const currentRows = await tx.schoolService.findMany({
          where: { schoolId },
          select: { serviceId: true },
        });
        const current = new Set(
          currentRows.map((row) => PRISMA_TO_DOMAIN[row.serviceId]),
        );
        const desiredSet = new Set(desired);

        const toRemove = [...current].filter(
          (serviceId) => !desiredSet.has(serviceId),
        );
        const toAdd = desired.filter((serviceId) => !current.has(serviceId));

        if (toRemove.length > 0) {
          await tx.schoolService.deleteMany({
            where: {
              schoolId,
              serviceId: {
                in: toRemove.map((serviceId) => DOMAIN_TO_PRISMA[serviceId]),
              },
            },
          });
        }

        if (toAdd.length > 0) {
          await tx.schoolService.createMany({
            data: toAdd.map((serviceId) => ({
              id: crypto.randomUUID(),
              schoolId,
              serviceId: DOMAIN_TO_PRISMA[serviceId],
            })),
          });
        }

        await tx.school.update({
          where: { id: schoolId },
          data: { servicesConfiguredAt: new Date() },
        });

        return desired;
      },
      { maxWait: 10000, timeout: 20000 },
    );
  }
}
