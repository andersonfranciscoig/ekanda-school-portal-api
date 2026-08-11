import { SchoolSubscriptionExpiredException } from '../../../billing/domain/exceptions/billing.exceptions';
import { CreateApplicationUseCase } from './create-application.use-case';

describe('CreateApplicationUseCase entitlements', () => {
  it('blocks applications when the school subscription is expired', async () => {
    const entitlements = {
      assertCanReceiveApplications: jest
        .fn()
        .mockRejectedValue(new SchoolSubscriptionExpiredException()),
    };
    const prisma = {
      school: { findUnique: jest.fn() },
      student: { findUnique: jest.fn() },
      application: { create: jest.fn() },
    };
    const useCase = new CreateApplicationUseCase(
      entitlements as never,
      prisma as never,
    );

    await expect(
      useCase.execute({
        actorUserId: 'user-1',
        schoolId: 'school-1',
        studentId: 'student-1',
      }),
    ).rejects.toMatchObject({ code: 'SCHOOL_SUBSCRIPTION_EXPIRED' });
    expect(prisma.application.create).not.toHaveBeenCalled();
  });

  it('creates the application when the entitlement is granted', async () => {
    const entitlements = {
      assertCanReceiveApplications: jest.fn().mockResolvedValue(undefined),
    };
    const prisma = {
      school: { findUnique: jest.fn().mockResolvedValue({ id: 'school-1' }) },
      student: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'student-1',
          guardianId: 'user-1',
        }),
      },
      application: {
        create: jest.fn().mockResolvedValue({
          id: 'app-1',
          schoolId: 'school-1',
          studentId: 'student-1',
          guardianId: 'user-1',
          status: 'SUBMITTED',
          submittedAt: new Date('2026-08-11T00:00:00.000Z'),
        }),
      },
    };
    const useCase = new CreateApplicationUseCase(
      entitlements as never,
      prisma as never,
    );

    const result = await useCase.execute({
      actorUserId: 'user-1',
      schoolId: 'school-1',
      studentId: 'student-1',
    });

    expect(result).toMatchObject({
      id: 'app-1',
      status: 'SUBMITTED',
    });
  });
});
