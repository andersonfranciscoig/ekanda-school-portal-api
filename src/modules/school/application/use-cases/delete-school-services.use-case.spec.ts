import { School } from '../../domain/aggregates/school.aggregate';
import {
  SchoolAccessDeniedException,
  SchoolServicesNotFoundException,
} from '../../domain/exceptions/school.exceptions';
import {
  SchoolMembershipRole,
  SchoolServiceCatalogId,
} from '../../domain/school.enums';
import { SchoolSlug } from '../../domain/value-objects/school-slug.vo';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';
import { DeleteSchoolServicesUseCase } from './delete-school-services.use-case';

describe('DeleteSchoolServicesUseCase', () => {
  const schoolId = '11111111-1111-1111-1111-111111111111';
  const actorUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  let services: {
    findBySchoolId: jest.Mock;
    sync: jest.Mock;
  };
  let access: {
    assertSchoolExists: jest.Mock;
    assertCanManageSchool: jest.Mock;
  };
  let audit: { log: jest.Mock };
  let useCase: DeleteSchoolServicesUseCase;

  const school = School.create({
    id: schoolId,
    name: 'Colégio Horizonte',
    slug: SchoolSlug.create('colegio-horizonte'),
    ownerUserId: actorUserId,
  });

  beforeEach(() => {
    services = {
      findBySchoolId: jest
        .fn()
        .mockResolvedValue([
          SchoolServiceCatalogId.TRANSPORTE,
          SchoolServiceCatalogId.CANTINA,
        ]),
      sync: jest.fn().mockResolvedValue([]),
    };
    access = {
      assertSchoolExists: jest.fn().mockResolvedValue(school),
      assertCanManageSchool: jest.fn().mockResolvedValue({
        userId: actorUserId,
        schoolId,
        role: SchoolMembershipRole.OWNER,
        status: 'ACTIVE',
      }),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    useCase = new DeleteSchoolServicesUseCase(
      services as never,
      access as unknown as SchoolAccessAuthorizer,
      audit as never,
    );
  });

  it('clears all services', async () => {
    const result = await useCase.execute({ schoolId, actorUserId });
    expect(result.deleted).toBe(true);
    expect(result.serviceIds).toEqual([]);
    expect(services.sync).toHaveBeenCalledWith(schoolId, []);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SCHOOL_SERVICES_DELETED' }),
    );
  });

  it('throws when no services exist', async () => {
    services.findBySchoolId.mockResolvedValue([]);
    await expect(
      useCase.execute({ schoolId, actorUserId }),
    ).rejects.toBeInstanceOf(SchoolServicesNotFoundException);
  });

  it('rejects unauthorized actor', async () => {
    access.assertCanManageSchool.mockRejectedValue(
      new SchoolAccessDeniedException(),
    );
    await expect(
      useCase.execute({ schoolId, actorUserId }),
    ).rejects.toBeInstanceOf(SchoolAccessDeniedException);
  });
});
