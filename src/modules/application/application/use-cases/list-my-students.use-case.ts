import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import {
  presentStudent,
  type StudentDto,
} from './create-or-update-student.use-case';

@Injectable()
export class ListMyStudentsUseCase
  implements UseCase<{ actorUserId: string }, { items: StudentDto[] }>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: { actorUserId: string }) {
    const rows = await this.prisma.student.findMany({
      where: { guardianId: input.actorUserId },
      orderBy: { createdAt: 'asc' },
    });
    return { items: rows.map(presentStudent) };
  }
}
