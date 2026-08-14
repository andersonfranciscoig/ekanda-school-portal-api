import { Injectable } from '@nestjs/common';
import { Shift } from '@prisma/client';
import { UseCase } from '../../../../shared/application/use-case';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import { MailService } from '../../../mail/application/mail.service';
import { MailRecipientsService } from '../../../mail/application/mail-recipients.service';
import { applicationCode } from '../services/application.presenter';
import { SchoolEntitlementService } from '../../../billing/application/services/school-entitlement.service';
import {
  BusinessRuleViolationException,
  EntityNotFoundException,
  ForbiddenDomainException,
} from '../../../../shared/domain/exceptions/domain.exception';

export type CreateApplicationInput = {
  actorUserId: string;
  schoolId: string;
  studentId: string;
  schoolClassId?: string | null;
  requestedShift?: string | null;
  notes?: string | null;
};

@Injectable()
export class CreateApplicationUseCase
  implements UseCase<CreateApplicationInput, unknown>
{
  constructor(
    private readonly entitlements: SchoolEntitlementService,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly recipients: MailRecipientsService,
  ) {}

  async execute(input: CreateApplicationInput) {
    await this.entitlements.assertCanReceiveApplications(input.schoolId);

    const school = await this.prisma.school.findUnique({
      where: { id: input.schoolId },
      select: { id: true },
    });
    if (!school) throw new EntityNotFoundException('School not found');

    const student = await this.prisma.student.findUnique({
      where: { id: input.studentId },
      select: { id: true, guardianId: true },
    });
    if (!student) throw new EntityNotFoundException('Student not found');
    if (student.guardianId !== input.actorUserId) {
      throw new ForbiddenDomainException(
        'Student does not belong to the authenticated guardian',
      );
    }

    if (input.schoolClassId) {
      const schoolClass = await this.prisma.schoolClass.findUnique({
        where: { id: input.schoolClassId },
        select: { id: true, schoolId: true, isActive: true },
      });
      if (!schoolClass || schoolClass.schoolId !== input.schoolId) {
        throw new BusinessRuleViolationException(
          'School class does not belong to this school',
        );
      }
      if (schoolClass.isActive === false) {
        throw new BusinessRuleViolationException('School class is not active');
      }
    }

    const application = await this.prisma.application.create({
      data: {
        id: crypto.randomUUID(),
        schoolId: input.schoolId,
        studentId: input.studentId,
        guardianId: input.actorUserId,
        schoolClassId: input.schoolClassId ?? null,
        requestedShift: (input.requestedShift as Shift | null) ?? null,
        notes: input.notes ?? null,
        statusHistory: {
          create: {
            id: crypto.randomUUID(),
            toStatus: 'SUBMITTED',
            changedByUserId: input.actorUserId,
          },
        },
      },
      include: {
        school: { select: { id: true, name: true } },
        student: { select: { firstName: true, lastName: true } },
        guardian: { select: { firstName: true, lastName: true } },
      },
    });

    const owner = await this.recipients.schoolOwner(input.schoolId);
    if (owner) {
      const studentName = `${application.student.firstName} ${application.student.lastName}`.trim();
      const guardianName = `${application.guardian.firstName} ${application.guardian.lastName}`.trim();
      this.mail.sendApplicationSubmittedSchool({
        email: owner.email,
        schoolName: application.school.name,
        studentName,
        guardianName,
        applicationCode: applicationCode(application.id),
        schoolId: application.school.id,
      });
    }

    return {
      id: application.id,
      schoolId: application.schoolId,
      studentId: application.studentId,
      guardianId: application.guardianId,
      status: application.status,
      submittedAt: application.submittedAt.toISOString(),
    };
  }
}
