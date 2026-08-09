import { Injectable } from '@nestjs/common';
import { Shift as PrismaShift } from '@prisma/client';
import { PrismaService } from '../../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { SchoolClass } from '../../../domain/entities/school-class.entity';
import { SchoolClassRepository } from '../../../domain/repositories/school-class.repository';
import { SchoolClassShift } from '../../../domain/school.enums';

type ClassRecord = {
  id: string;
  schoolId: string;
  classLabel: string;
  vacancies: number;
  shift: PrismaShift;
  schedule: string | null;
  isActive: boolean;
};

const DOMAIN_TO_PRISMA: Record<SchoolClassShift, PrismaShift> = {
  [SchoolClassShift.MORNING]: PrismaShift.MORNING,
  [SchoolClassShift.AFTERNOON]: PrismaShift.AFTERNOON,
  [SchoolClassShift.NIGHT]: PrismaShift.NIGHT,
  [SchoolClassShift.DOUBLE]: PrismaShift.DOUBLE,
};

const PRISMA_TO_DOMAIN: Record<PrismaShift, SchoolClassShift> = {
  [PrismaShift.MORNING]: SchoolClassShift.MORNING,
  [PrismaShift.AFTERNOON]: SchoolClassShift.AFTERNOON,
  [PrismaShift.NIGHT]: SchoolClassShift.NIGHT,
  [PrismaShift.DOUBLE]: SchoolClassShift.DOUBLE,
};

@Injectable()
export class PrismaSchoolClassRepository implements SchoolClassRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<SchoolClass | null> {
    const record = await this.prisma.schoolClass.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async create(schoolClass: SchoolClass): Promise<SchoolClass> {
    const snap = schoolClass.toSnapshot();
    const record = await this.prisma.schoolClass.create({
      data: {
        id: snap.id,
        schoolId: snap.schoolId,
        classLabel: snap.classLabel,
        vacancies: snap.vacancies,
        shift: DOMAIN_TO_PRISMA[snap.shift],
        schedule: snap.schedule,
        isActive: snap.isActive,
      },
    });
    return this.toDomain(record);
  }

  async update(schoolClass: SchoolClass): Promise<SchoolClass> {
    const snap = schoolClass.toSnapshot();
    const record = await this.prisma.schoolClass.update({
      where: { id: snap.id },
      data: {
        classLabel: snap.classLabel,
        vacancies: snap.vacancies,
        shift: DOMAIN_TO_PRISMA[snap.shift],
        schedule: snap.schedule,
        isActive: snap.isActive,
      },
    });
    return this.toDomain(record);
  }

  private toDomain(record: ClassRecord): SchoolClass {
    return SchoolClass.rehydrate({
      id: record.id,
      schoolId: record.schoolId,
      classLabel: record.classLabel,
      vacancies: record.vacancies,
      shift: PRISMA_TO_DOMAIN[record.shift],
      schedule: record.schedule,
      isActive: record.isActive,
    });
  }
}
