import { Injectable } from '@nestjs/common';
import { Gender } from '@prisma/client';
import { UseCase } from '../../../../shared/application/use-case';
import {
  EntityNotFoundException,
  ForbiddenDomainException,
} from '../../../../shared/domain/exceptions/domain.exception';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';

export type CreateOrUpdateStudentInput = {
  actorUserId: string;
  id?: string | null;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender?: Gender | null;
  documentNumber?: string | null;
};

export type StudentDto = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  birthDate: string;
  gender: string | null;
  documentNumber: string | null;
};

@Injectable()
export class CreateOrUpdateStudentUseCase
  implements UseCase<CreateOrUpdateStudentInput, StudentDto>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: CreateOrUpdateStudentInput): Promise<StudentDto> {
    const birthDate = new Date(`${input.birthDate.slice(0, 10)}T00:00:00.000Z`);
    const data = {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      birthDate,
      gender: input.gender ?? null,
      documentNumber: input.documentNumber?.trim() || null,
    };

    if (input.id) {
      const existing = await this.prisma.student.findUnique({
        where: { id: input.id },
      });
      if (!existing) throw new EntityNotFoundException('Student not found');
      if (existing.guardianId !== input.actorUserId) {
        throw new ForbiddenDomainException('Student does not belong to you');
      }
      const updated = await this.prisma.student.update({
        where: { id: existing.id },
        data,
      });
      return presentStudent(updated);
    }

    const created = await this.prisma.student.create({
      data: {
        id: crypto.randomUUID(),
        guardianId: input.actorUserId,
        ...data,
      },
    });
    return presentStudent(created);
  }
}

export function presentStudent(row: {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: Date;
  gender: string | null;
  documentNumber: string | null;
}): StudentDto {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    name: `${row.firstName} ${row.lastName}`.trim(),
    birthDate: row.birthDate.toISOString().slice(0, 10),
    gender: row.gender,
    documentNumber: row.documentNumber,
  };
}
