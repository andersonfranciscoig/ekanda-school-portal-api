import { Injectable } from '@nestjs/common';
import { ConciergeVisitStatus, NotificationType } from '@prisma/client';
import { UseCase } from '../../../../shared/application/use-case';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import {
  ConciergeSchoolNotFoundException,
  ConciergeVisitNotFoundException,
  InvalidVisitTimeException,
} from '../../domain/exceptions/concierge.exceptions';
import { ALLOWED_VISIT_TIMES } from '../../domain/concierge.types';
import { presentConciergeVisit } from '../../infrastructure/http/concierge-visit.presenter';
import { InAppNotificationService } from '../../../notification/application/in-app-notification.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: InAppNotificationService,
  ) {}

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

    await this.notifications.notifySchoolMembers(school.id, {
      type: NotificationType.SYSTEM,
      audience: 'school',
      source: 'visita',
      title: 'Novo pedido de visita',
      message: `${visit.contactName} pediu uma visita a ${school.name} (${visit.date.toISOString().slice(0, 10)} às ${visit.time}).`,
      href: '/dashboard/visitas',
      metadata: { visitId: visit.id, visitCode: visit.code, schoolId: school.id },
    });

    if (visit.userId) {
      await this.notifications.create({
        userId: visit.userId,
        type: NotificationType.SYSTEM,
        audience: 'guardian',
        source: 'visita',
        title: 'Pedido de visita enviado',
        message: `O pedido ${visit.code} para ${school.name} foi enviado. Aguarde a confirmação do colégio.`,
        href: '/encarregado/visitas',
        metadata: { visitId: visit.id, visitCode: visit.code, schoolId: school.id },
      });
    }

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
