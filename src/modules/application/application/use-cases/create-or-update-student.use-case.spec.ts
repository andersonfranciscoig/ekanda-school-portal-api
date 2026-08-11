import { Gender } from '@prisma/client';
import {
  EntityNotFoundException,
  ForbiddenDomainException,
} from '../../../../shared/domain/exceptions/domain.exception';
import { CreateOrUpdateStudentUseCase } from './create-or-update-student.use-case';
import { ListMyStudentsUseCase } from './list-my-students.use-case';

describe('Students (guardian)', () => {
  const guardianId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  describe('CreateOrUpdateStudentUseCase', () => {
    it('creates a student owned by the JWT guardian', async () => {
      const prisma = {
        student: {
          create: jest.fn().mockImplementation(async ({ data }) => ({
            ...data,
            documentNumber: null,
          })),
        },
      };
      const useCase = new CreateOrUpdateStudentUseCase(prisma as never);
      const result = await useCase.execute({
        actorUserId: guardianId,
        firstName: 'Ana',
        lastName: 'Silva',
        birthDate: '2014-03-02',
        gender: Gender.FEMALE,
      });

      expect(result).toMatchObject({
        firstName: 'Ana',
        lastName: 'Silva',
        name: 'Ana Silva',
        birthDate: '2014-03-02',
        gender: 'FEMALE',
        documentNumber: null,
      });
      expect(prisma.student.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ guardianId }),
        }),
      );
    });

    it('updates only when the student belongs to the guardian', async () => {
      const prisma = {
        student: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'stu-1',
            guardianId,
          }),
          update: jest.fn().mockResolvedValue({
            id: 'stu-1',
            firstName: 'Ana',
            lastName: 'Costa',
            birthDate: new Date('2014-03-02T00:00:00.000Z'),
            gender: 'FEMALE',
            documentNumber: null,
          }),
        },
      };
      const useCase = new CreateOrUpdateStudentUseCase(prisma as never);
      const result = await useCase.execute({
        actorUserId: guardianId,
        id: 'stu-1',
        firstName: 'Ana',
        lastName: 'Costa',
        birthDate: '2014-03-02',
        gender: Gender.FEMALE,
      });
      expect(result.name).toBe('Ana Costa');
      expect(prisma.student.update).toHaveBeenCalled();
    });

    it('returns 403 when updating another guardian student', async () => {
      const prisma = {
        student: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'stu-1',
            guardianId: 'other',
          }),
          update: jest.fn(),
        },
      };
      const useCase = new CreateOrUpdateStudentUseCase(prisma as never);
      await expect(
        useCase.execute({
          actorUserId: guardianId,
          id: 'stu-1',
          firstName: 'Ana',
          lastName: 'Silva',
          birthDate: '2014-03-02',
        }),
      ).rejects.toBeInstanceOf(ForbiddenDomainException);
      expect(prisma.student.update).not.toHaveBeenCalled();
    });

    it('returns 404 when student id does not exist', async () => {
      const prisma = {
        student: { findUnique: jest.fn().mockResolvedValue(null) },
      };
      const useCase = new CreateOrUpdateStudentUseCase(prisma as never);
      await expect(
        useCase.execute({
          actorUserId: guardianId,
          id: 'missing',
          firstName: 'Ana',
          lastName: 'Silva',
          birthDate: '2014-03-02',
        }),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });
  });

  describe('ListMyStudentsUseCase', () => {
    it('lists only the authenticated guardian children', async () => {
      const prisma = {
        student: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'stu-1',
              firstName: 'Ana',
              lastName: 'Silva',
              birthDate: new Date('2014-03-02T00:00:00.000Z'),
              gender: 'FEMALE',
              documentNumber: null,
            },
          ]),
        },
      };
      const useCase = new ListMyStudentsUseCase(prisma as never);
      const result = await useCase.execute({ actorUserId: guardianId });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Ana Silva');
      expect(prisma.student.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { guardianId },
        }),
      );
    });
  });
});
