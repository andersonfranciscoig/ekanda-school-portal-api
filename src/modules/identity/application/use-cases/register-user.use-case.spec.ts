import {
  ConflictDomainException,
  ForbiddenDomainException,
  UnauthorizedDomainException,
} from '../../../../shared/domain/exceptions/domain.exception';
import { Email } from '../../../../shared/domain/value-objects/email.vo';
import { PasswordHasher } from '../ports/password-hasher.port';
import { TokenIssuer } from '../ports/token-issuer.port';
import { User, UserRole } from '../../domain/entities/user.entity';
import { UserRepository } from '../../domain/repositories/user.repository';
import { RegisterUserUseCase } from './register-user.use-case';

describe('RegisterUserUseCase', () => {
  let users: jest.Mocked<UserRepository>;
  let hasher: jest.Mocked<PasswordHasher>;
  let tokens: jest.Mocked<TokenIssuer>;
  let useCase: RegisterUserUseCase;

  beforeEach(() => {
    users = {
      save: jest.fn(async (u) => u),
      findById: jest.fn(),
      findByEmail: jest.fn().mockResolvedValue(null),
      findByPhone: jest.fn().mockResolvedValue(null),
    };
    hasher = {
      hash: jest.fn().mockResolvedValue('hash'),
      compare: jest.fn(),
    };
    tokens = {
      issue: jest.fn().mockResolvedValue('token'),
      issuePair: jest.fn().mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' }),
      verifyRefresh: jest.fn().mockResolvedValue({ sub: '1', email: 'a@b.c', role: 'GUARDIAN' }),
    };
    useCase = new RegisterUserUseCase(users, hasher, tokens);
  });

  it('registers GUARDIAN without actor', async () => {
    const result = await useCase.execute({
      firstName: 'Maria',
      lastName: 'Silva',
      email: 'maria@email.com',
      password: 'SenhaForte123',
      role: UserRole.GUARDIAN,
    });

    expect(result.user.role).toBe(UserRole.GUARDIAN);
    expect(result.accessToken).toBe('token');
  });

  it('rejects EKANDA_ADMIN without authentication', async () => {
    await expect(
      useCase.execute({
        firstName: 'Admin',
        lastName: 'Ekanda',
        email: 'admin@ekanda.ao',
        password: 'SenhaForte123',
        role: UserRole.EKANDA_ADMIN,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedDomainException);
  });

  it('rejects EKANDA_ADMIN when actor is not platform admin', async () => {
    await expect(
      useCase.execute({
        firstName: 'Admin',
        lastName: 'Ekanda',
        email: 'admin@ekanda.ao',
        password: 'SenhaForte123',
        role: UserRole.EKANDA_ADMIN,
        actorUserId: 'u1',
        actorRole: UserRole.SCHOOL_OWNER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenDomainException);
  });

  it('creates EKANDA_ADMIN when actor is EKANDA_ADMIN', async () => {
    const result = await useCase.execute({
      firstName: 'Admin',
      lastName: 'Ekanda',
      email: 'admin@ekanda.ao',
      password: 'SenhaForte123',
      role: UserRole.EKANDA_ADMIN,
      actorUserId: 'admin-1',
      actorRole: UserRole.EKANDA_ADMIN,
    });

    expect(result.user.role).toBe(UserRole.EKANDA_ADMIN);
    expect(users.save).toHaveBeenCalled();
  });

  it('rejects duplicate email', async () => {
    users.findByEmail.mockResolvedValue(
      User.rehydrate({
        id: 'x',
        firstName: 'A',
        lastName: 'B',
        email: Email.create('maria@email.com'),
        phone: null,
        passwordHash: 'h',
        role: UserRole.GUARDIAN,
        isActive: true,
        emailVerified: false,
        phoneVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    await expect(
      useCase.execute({
        firstName: 'Maria',
        lastName: 'Silva',
        email: 'maria@email.com',
        password: 'SenhaForte123',
      }),
    ).rejects.toBeInstanceOf(ConflictDomainException);
  });
});
