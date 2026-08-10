import { Injectable } from '@nestjs/common';
import { ConciergeVisitStatus } from '@prisma/client';
import { UseCase } from '../../../../shared/application/use-case';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import {
  ConciergeSchoolNotFoundException,
  ConciergeVisitNotFoundException,
  InvalidVisitTimeException,
} from '../../domain/exceptions/concierge.exceptions';
import { ALLOWED_VISIT_TIMES } from '../../domain/concierge.types';
import { presentConciergeVisit } from '../../infrastructure/http/concierge-visit.presenter';

export type ScheduleConciergeVisitInput = {
  schoolId: string;
  date: string;
  time: string;
  contactName: string;
  contactPhone: string;
  sessionId?: string;
  userId?: string | null;
};

export type GetConciergeVisitInput = {
  code: string;
};

@Injectable()
export class ScheduleConciergeVisitUseCase
  implements UseCase<ScheduleConciergeVisitInput, unknown>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ScheduleConciergeVisitInput) {
    if (
      !ALLOWED_VISIT_TIMES.includes(
        input.time as (typeof ALLOWED_VISIT_TIMES)[number],
      )
    ) {
      throw new InvalidVisitTimeException(
        `time must be one of: ${ALLOWED_VISIT_TIMES.join(', ')}`,
      );
    }

    const school = await this.prisma.school.findUnique({
      where: { id: input.schoolId },
      select: { id: true, name: true, slug: true },
    });
    if (!school) throw new ConciergeSchoolNotFoundException();

    const year = new Date().getFullYear();
    const seq = (await this.prisma.conciergeVisit.count()) + 1;
    const code = `VIS-${year}-${String(seq).padStart(4, '0')}`;

    const visit = await this.prisma.conciergeVisit.create({
      data: {
        id: crypto.randomUUID(),
        code,
        schoolId: school.id,
        sessionId: input.sessionId ?? null,
        userId: input.userId ?? null,
        date: new Date(`${input.date}T00:00:00.000Z`),
        time: input.time,
        contactName: input.contactName.trim(),
        contactPhone: input.contactPhone.trim(),
        status: ConciergeVisitStatus.PENDING_SCHOOL_CONFIRMATION,
      },
      include: { school: { select: { id: true, name: true, slug: true } } },
    });

    return presentConciergeVisit(visit);
  }
}

@Injectable()
export class GetConciergeVisitByCodeUseCase
  implements UseCase<GetConciergeVisitInput, unknown>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: GetConciergeVisitInput) {
    const visit = await this.prisma.conciergeVisit.findUnique({
      where: { code: input.code.trim().toUpperCase() },
      include: {
        school: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!visit) throw new ConciergeVisitNotFoundException();
    return presentConciergeVisit(visit);
  }
}
