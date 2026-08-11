import {
  BusinessRuleViolationException,
  ConflictDomainException,
} from '../../../../shared/domain/exceptions/domain.exception';
import { Email } from '../../../../shared/domain/value-objects/email.vo';
import { User, UserRole } from '../../../identity/domain/entities/user.entity';
import { CreateAdminUserUseCase } from './create-admin-user.use-case';
import { PatchAdminUserUseCase } from './patch-admin-user.use-case';

describe('Admin users', () => {
  const actorId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  describe('CreateAdminUserUseCase', () => {
    let users: {
      save: jest.Mock;
      findByEmail: jest.Mock;
      findByPhone: jest.Mock;
    };
    let hasher: { hash: jest.Mock };
    let prisma: { user: { findUniqueOrThrow: jest.Mock } };
    let useCase: CreateAdminUserUseCase;

    beforeEach(() => {
      users = {
        save: jest.fn(async (user: User) => user),
        findByEmail: jest.fn().mockResolvedValue(null),
        findByPhone: jest.fn().mockResolvedValue(null),
      };
      hasher = { hash: jest.fn().mockResolvedValue('hash') };
      prisma = {
        user: {
          findUniqueOrThrow: jest.fn().mockImplementation(async ({ where }) => ({
            id: where.id,
            firstName: 'Novo',
            lastName: 'Admin',
            email: 'admin2@ekanda.ao',
            phone: '+244923000099',
            isActive: true,
            createdAt: new Date('2026-08-11T10:00:00.000Z'),
            platformRoles: [{ role: 'EKANDA_ADMIN' }],
          })),
        },
      };
      useCase = new CreateAdminUserUseCase(
        users as never,
        hasher as never,
        prisma as never,
        { log: jest.fn() } as never,
      );
    });

    it('creates EKANDA_ADMIN without issuing a token', async () => {
      const result = (await useCase.execute({
        firstName: 'Novo',
        lastName: 'Admin',
        email: 'admin2@ekanda.ao',
        phone: '+244923000099',
        password: 'SenhaForte123',
        role: UserRole.EKANDA_ADMIN,
      })) as { email: string; roles: string[]; accessToken?: string };

      expect(result.email).toBe('admin2@ekanda.ao');
      expect(result.roles).toEqual(['EKANDA_ADMIN']);
      expect(result.accessToken).toBeUndefined();
      expect(hasher.hash).toHaveBeenCalledWith('SenhaForte123');
    });

    it('rejects GUARDIAN', async () => {
      await expect(
        useCase.execute({
          firstName: 'Ana',
          lastName: 'Silva',
          email: 'ana@email.com',
          password: 'SenhaForte123',
          role: UserRole.GUARDIAN,
        }),
      ).rejects.toBeInstanceOf(BusinessRuleViolationException);
    });

    it('rejects duplicated email', async () => {
      users.findByEmail.mockResolvedValue({ id: 'u1' });
      await expect(
        useCase.execute({
          firstName: 'Novo',
          lastName: 'Admin',
          email: 'admin2@ekanda.ao',
          password: 'SenhaForte123',
          role: UserRole.EKANDA_ADMIN,
        }),
      ).rejects.toBeInstanceOf(ConflictDomainException);
    });
  });

  describe('PatchAdminUserUseCase', () => {
    it('deactivates another user', async () => {
      const target = User.create({
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        firstName: 'Inês',
        lastName: 'Costa',
        email: Email.create('ines@ekanda.ao'),
        passwordHash: 'hash',
        role: UserRole.EKANDA_ADMIN,
      });
      const users = {
        findById: jest.fn().mockResolvedValue(target),
        save: jest.fn(async (user: User) => user),
      };
      const prisma = {
        user: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: target.id,
            firstName: 'Inês',
            lastName: 'Costa',
            email: 'ines@ekanda.ao',
            phone: null,
            isActive: false,
            createdAt: target.createdAt,
            platformRoles: [{ role: 'EKANDA_ADMIN' }],
          }),
        },
      };
      const useCase = new PatchAdminUserUseCase(
        users as never,
        prisma as never,
        { log: jest.fn() } as never,
      );
      const result = (await useCase.execute({
        actorUserId: actorId,
        userId: target.id,
        isActive: false,
      })) as { isActive: boolean };
      expect(result.isActive).toBe(false);
      expect(users.save).toHaveBeenCalled();
    });

    it('forbids deactivating self', async () => {
      const useCase = new PatchAdminUserUseCase(
        { findById: jest.fn(), save: jest.fn() } as never,
        {} as never,
        { log: jest.fn() } as never,
      );
      await expect(
        useCase.execute({
          actorUserId: actorId,
          userId: actorId,
          isActive: false,
        }),
      ).rejects.toBeInstanceOf(BusinessRuleViolationException);
    });
  });
});
