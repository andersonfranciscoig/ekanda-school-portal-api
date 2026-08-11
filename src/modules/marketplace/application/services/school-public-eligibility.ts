import { SchoolStatus, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';
import {
  ReviewSchoolNotEligibleException,
  ReviewSchoolNotFoundException,
} from '../../domain/exceptions/marketplace.exceptions';

export async function assertSchoolIsPubliclyListed(
  prisma: PrismaService,
  schoolId: string,
): Promise<void> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, status: true },
  });
  if (!school) {
    throw new ReviewSchoolNotFoundException();
  }
  if (school.status !== SchoolStatus.ACTIVE) {
    throw new ReviewSchoolNotEligibleException();
  }

  const now = new Date();
  const validSub = await prisma.subscription.findFirst({
    where: {
      schoolId,
      status: SubscriptionStatus.ACTIVE,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gt: now } }] },
      ],
    },
    select: { id: true },
  });
  if (!validSub) {
    throw new ReviewSchoolNotEligibleException(
      'School is not publicly listed (missing valid subscription)',
    );
  }
}
