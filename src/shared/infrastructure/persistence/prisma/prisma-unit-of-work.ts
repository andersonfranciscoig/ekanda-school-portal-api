import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../persistence/prisma/prisma.service';
import { UnitOfWork } from '../../../application/ports/unit-of-work.port';

@Injectable()
export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly prisma: PrismaService) {}

  runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    return this.prisma.$transaction(
      async () => work(),
      { maxWait: 10000, timeout: 20000 },
    );
  }
}
