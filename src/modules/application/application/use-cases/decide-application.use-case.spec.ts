import { ApplicationStatus } from '@prisma/client';
import {
  BusinessRuleViolationException,
  EntityNotFoundException,
} from '../../../../shared/domain/exceptions/domain.exception';
import { ApproveApplicationUseCase } from './approve-application.use-case';
import { RejectApplicationUseCase } from './reject-application.use-case';

describe('Decide application', () => {
  const schoolId = '11111111-1111-1111-1111-111111111111';
  const applicationId = '22222222-2222-2222-2222-222222222222';
  const actorUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  const detailRow = {
    id: applicationId,
    status: ApplicationStatus.ACCEPTED,
    submittedAt: new Date('2026-08-11T10:00:00.000Z'),
    reviewedAt: new Date('2026-08-11T11:00:00.000Z'),
    notes: null,
    requestedShift: 'MORNING',
    school: { id: schoolId, name: 'Horizonte', slug: 'horizonte' },
    student: {
      id: 's1',
      firstName: 'Ana',
      lastName: 'Correia',
      birthDate: new Date('2014-03-02'),
    },
    guardian: {
      id: 'g1',
      firstName: 'Maria',
      lastName: 'Correia',
      email: 'maria@email.com',
      phone: '+2449',
    },
    schoolClass: { classLabel: '7.ª Classe' },
    documents: [],
    statusHistory: [],
  };

  function prismaMock(currentStatus: ApplicationStatus) {
    return {
      application: {
        findFirst: jest.fn().mockResolvedValue({
          id: applicationId,
          schoolId,
          status: currentStatus,
          notes: null,
        }),
        update: jest.fn().mockResolvedValue({}),
        findUniqueOrThrow: jest.fn().mockResolvedValue(detailRow),
      },
    };
  }

  it('accepts a submitted application', async () => {
    const prisma = prismaMock(ApplicationStatus.SUBMITTED);
    const access = { assertCanManageSchool: jest.fn().mockResolvedValue({}) };
    const useCase = new ApproveApplicationUseCase(
      access as never,
      prisma as never,
    );
    const result = (await useCase.execute({
      actorUserId,
      schoolId,
      applicationId,
    })) as { status: string; code: string };
    expect(result.code).toMatch(/^EKD-APP-/);
    expect(prisma.application.update).toHaveBeenCalled();
    expect(access.assertCanManageSchool).toHaveBeenCalledWith(
      actorUserId,
      schoolId,
    );
  });

  it('rejects already accepted applications', async () => {
    const prisma = prismaMock(ApplicationStatus.ACCEPTED);
    const access = { assertCanManageSchool: jest.fn().mockResolvedValue({}) };
    const useCase = new ApproveApplicationUseCase(
      access as never,
      prisma as never,
    );
    await expect(
      useCase.execute({ actorUserId, schoolId, applicationId }),
    ).rejects.toBeInstanceOf(BusinessRuleViolationException);
  });

  it('rejects with reason and records history', async () => {
    const prisma = prismaMock(ApplicationStatus.UNDER_REVIEW);
    const access = { assertCanManageSchool: jest.fn().mockResolvedValue({}) };
    const useCase = new RejectApplicationUseCase(
      access as never,
      prisma as never,
    );
    await useCase.execute({
      actorUserId,
      schoolId,
      applicationId,
      reason: 'Falta de vaga na turma',
    });
    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ApplicationStatus.REJECTED,
          statusHistory: {
            create: expect.objectContaining({
              toStatus: ApplicationStatus.REJECTED,
              reason: 'Falta de vaga na turma',
            }),
          },
        }),
      }),
    );
  });

  it('requires a reason with at least 5 characters', async () => {
    const useCase = new RejectApplicationUseCase(
      { assertCanManageSchool: jest.fn() } as never,
      { application: {} } as never,
    );
    await expect(
      useCase.execute({
        actorUserId,
        schoolId,
        applicationId,
        reason: 'no',
      }),
    ).rejects.toBeInstanceOf(BusinessRuleViolationException);
  });

  it('throws when application is missing', async () => {
    const prisma = {
      application: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const useCase = new ApproveApplicationUseCase(
      { assertCanManageSchool: jest.fn().mockResolvedValue({}) } as never,
      prisma as never,
    );
    await expect(
      useCase.execute({ actorUserId, schoolId, applicationId }),
    ).rejects.toBeInstanceOf(EntityNotFoundException);
  });
});
