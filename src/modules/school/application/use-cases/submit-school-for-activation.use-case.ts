import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { SchoolEntitlementService } from '../../../billing/application/services/school-entitlement.service';
import { SchoolNotFoundException } from '../../domain/exceptions/school.exceptions';
import {
  SCHOOL_REPOSITORY,
  SchoolRepository,
} from '../../domain/repositories/school.repository';
import { SchoolStatus } from '../../domain/school.enums';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';
import { MailService } from '../../../mail/application/mail.service';
import { MailRecipientsService } from '../../../mail/application/mail-recipients.service';

export type SubmitSchoolForActivationInput = {
  schoolId: string;
  userId: string;
};

export type SubmitSchoolForActivationOutput = {
  schoolId: string;
  status: SchoolStatus;
};

@Injectable()
export class SubmitSchoolForActivationUseCase
  implements
    UseCase<SubmitSchoolForActivationInput, SubmitSchoolForActivationOutput>
{
  constructor(
    @Inject(SCHOOL_REPOSITORY)
    private readonly schools: SchoolRepository,
    private readonly access: SchoolAccessAuthorizer,
    private readonly entitlements: SchoolEntitlementService,
    private readonly mail: MailService,
    private readonly recipients: MailRecipientsService,
  ) {}

  async execute(
    input: SubmitSchoolForActivationInput,
  ): Promise<SubmitSchoolForActivationOutput> {
    await this.access.assertCanManageSchool(input.userId, input.schoolId);

    const school = await this.schools.findById(input.schoolId);
    if (!school) throw new SchoolNotFoundException();

    if (
      school.status === SchoolStatus.PENDING_REVIEW ||
      school.status === SchoolStatus.ACTIVE
    ) {
      return { schoolId: school.id, status: school.status };
    }

    const subscription = await this.entitlements.getDashboardSubscription(
      school.id,
    );

    school.submitForActivation({
      hasMinimumProfile: school.hasMinimumProfile(),
      hasLocation: school.location != null,
      hasActiveClass:
        school.classes.some((item) => item.isActive) ||
        school.classes.length > 0,
      hasValidSubscription: Boolean(subscription && !subscription.isExpired),
    });

    await this.schools.save(school);

    const newStatus = school.status as SchoolStatus;
    if (newStatus === SchoolStatus.PENDING_REVIEW) {
      const owner = await this.recipients.schoolOwner(school.id);
      if (owner) {
        this.mail.sendSchoolSubmitted({
          email: owner.email,
          ownerName: owner.name,
          schoolName: school.name,
        });
      }
      this.mail.sendSchoolPendingReviewOps({
        schoolName: school.name,
        ownerEmail: owner?.email ?? '—',
        schoolId: school.id,
      });
    }

    return { schoolId: school.id, status: school.status };
  }
}
