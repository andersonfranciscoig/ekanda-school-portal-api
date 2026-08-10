import { School } from '../../domain/aggregates/school.aggregate';
import {
  DuplicateSchoolServiceException,
  InvalidSchoolServiceException,
  SchoolAccessDeniedException,
  SchoolNotFoundException,
} from '../../domain/exceptions/school.exceptions';
import {
  SchoolMembershipRole,
  SchoolServiceCatalogId,
} from '../../domain/school.enums';
import { SchoolSlug } from '../../domain/value-objects/school-slug.vo';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';
import { SyncSchoolServicesUseCase } from './sync-school-services.use-case';

describe('SyncSchoolServicesUseCase', () => {
  const schoolId = '11111111-1111-1111-1111-111111111111';
  const otherSchoolId = '22222222-2222-2222-2222-222222222222';
  const actorUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  let services: {
    findBySchoolId: jest.Mock;
    sync: jest.Mock;
  };
  let access: {
    assertSchoolExists: jest.Mock;
    assertCanManageSchool: jest.Mock;
  };
  let useCase: SyncSchoolServicesUseCase;

  const school = School.create({
    id: schoolId,
    name: 'Colégio Horizonte',
    slug: SchoolSlug.create('colegio-horizonte'),
    ownerUserId: actorUserId,
  });

  const ownerMembership = {
    userId: actorUserId,
    schoolId,
    role: SchoolMembershipRole.OWNER,
    status: 'ACTIVE',
  };

  const adminMembership = {
    ...ownerMembership,
    role: SchoolMembershipRole.ADMIN,
  };

  beforeEach(() => {
    services = {
      findBySchoolId: jest.fn(),
      sync: jest.fn(
        async (_id: string, serviceIds: SchoolServiceCatalogId[]) => serviceIds,
      ),
    };
    access = {
      assertSchoolExists: jest.fn().mockResolvedValue(school),
      assertCanManageSchool: jest.fn().mockResolvedValue(ownerMembership),
    };
    useCase = new SyncSchoolServicesUseCase(
      services as never,
      access as unknown as SchoolAccessAuthorizer,
    );
  });

  it('creates services when school has none', async () => {
    const result = await useCase.execute({
      schoolId,
      actorUserId,
      serviceIds: ['transporte', 'cantina'],
    });

    expect(result.serviceIds).toEqual([
      SchoolServiceCatalogId.TRANSPORTE,
      SchoolServiceCatalogId.CANTINA,
    ]);
    expect(services.sync).toHaveBeenCalledWith(schoolId, [
      SchoolServiceCatalogId.TRANSPORTE,
      SchoolServiceCatalogId.CANTINA,
    ]);
  });

  it('adds a service via desired state', async () => {
    await useCase.execute({
      schoolId,
      actorUserId,
      serviceIds: ['transporte', 'cantina'],
    });

    expect(services.sync).toHaveBeenCalledWith(schoolId, [
      SchoolServiceCatalogId.TRANSPORTE,
      SchoolServiceCatalogId.CANTINA,
    ]);
  });

  it('removes a service missing from request', async () => {
    await useCase.execute({
      schoolId,
      actorUserId,
      serviceIds: ['transporte'],
    });

    expect(services.sync).toHaveBeenCalledWith(schoolId, [
      SchoolServiceCatalogId.TRANSPORTE,
    ]);
  });

  it('accepts empty serviceIds and clears all', async () => {
    services.sync.mockResolvedValue([]);

    const result = await useCase.execute({
      schoolId,
      actorUserId,
      serviceIds: [],
    });

    expect(result.serviceIds).toEqual([]);
    expect(services.sync).toHaveBeenCalledWith(schoolId, []);
  });

  it('rejects invalid service id', async () => {
    await expect(
      useCase.execute({
        schoolId,
        actorUserId,
        serviceIds: ['transporte', 'piscina'],
      }),
    ).rejects.toBeInstanceOf(InvalidSchoolServiceException);
    expect(services.sync).not.toHaveBeenCalled();
  });

  it('rejects duplicate service ids', async () => {
    await expect(
      useCase.execute({
        schoolId,
        actorUserId,
        serviceIds: ['transporte', 'transporte'],
      }),
    ).rejects.toBeInstanceOf(DuplicateSchoolServiceException);
    expect(services.sync).not.toHaveBeenCalled();
  });

  it('rejects user without access to school', async () => {
    access.assertCanManageSchool.mockRejectedValue(
      new SchoolAccessDeniedException(),
    );

    await expect(
      useCase.execute({
        schoolId,
        actorUserId,
        serviceIds: ['transporte'],
      }),
    ).rejects.toBeInstanceOf(SchoolAccessDeniedException);
    expect(services.sync).not.toHaveBeenCalled();
  });

  it('allows OWNER', async () => {
    access.assertCanManageSchool.mockResolvedValue(ownerMembership);

    await useCase.execute({
      schoolId,
      actorUserId,
      serviceIds: ['biblioteca'],
    });

    expect(access.assertCanManageSchool).toHaveBeenCalledWith(
      actorUserId,
      schoolId,
    );
    expect(services.sync).toHaveBeenCalled();
  });

  it('allows ADMIN', async () => {
    access.assertCanManageSchool.mockResolvedValue(adminMembership);

    await useCase.execute({
      schoolId,
      actorUserId,
      serviceIds: ['ingles'],
    });

    expect(services.sync).toHaveBeenCalledWith(schoolId, [
      SchoolServiceCatalogId.INGLES,
    ]);
  });

  it('does not persist when sync fails (atomicity surface)', async () => {
    services.sync.mockRejectedValue(new Error('tx failed'));

    await expect(
      useCase.execute({
        schoolId,
        actorUserId,
        serviceIds: ['transporte', 'cantina'],
      }),
    ).rejects.toThrow('tx failed');
  });

  it('rejects school not found', async () => {
    access.assertSchoolExists.mockRejectedValue(new SchoolNotFoundException());

    await expect(
      useCase.execute({
        schoolId,
        actorUserId,
        serviceIds: ['transporte'],
      }),
    ).rejects.toBeInstanceOf(SchoolNotFoundException);
    expect(services.sync).not.toHaveBeenCalled();
  });

  it('blocks cross-tenant sync', async () => {
    access.assertCanManageSchool.mockRejectedValue(
      new SchoolAccessDeniedException(),
    );

    await expect(
      useCase.execute({
        schoolId: otherSchoolId,
        actorUserId,
        serviceIds: ['transporte'],
      }),
    ).rejects.toBeInstanceOf(SchoolAccessDeniedException);

    expect(access.assertCanManageSchool).toHaveBeenCalledWith(
      actorUserId,
      otherSchoolId,
    );
    expect(services.sync).not.toHaveBeenCalled();
  });

  it('returns services in catalog order regardless of request order', async () => {
    const result = await useCase.execute({
      schoolId,
      actorUserId,
      serviceIds: ['extra', 'transporte', 'cantina'],
    });

    expect(result.serviceIds).toEqual([
      SchoolServiceCatalogId.TRANSPORTE,
      SchoolServiceCatalogId.CANTINA,
      SchoolServiceCatalogId.EXTRA,
    ]);
  });
});
