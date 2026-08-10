import { School } from '../../domain/aggregates/school.aggregate';
import { SchoolLocation } from '../../domain/entities/school-location.entity';
import {
  SchoolAccessDeniedException,
  SchoolLocationNotFoundException,
} from '../../domain/exceptions/school.exceptions';
import { SchoolMembershipRole } from '../../domain/school.enums';
import { SchoolSlug } from '../../domain/value-objects/school-slug.vo';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';
import { DeleteSchoolLocationUseCase } from './delete-school-location.use-case';

describe('DeleteSchoolLocationUseCase', () => {
  const schoolId = '11111111-1111-1111-1111-111111111111';
  const actorUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  let locations: {
    findBySchoolId: jest.Mock;
    deleteBySchoolId: jest.Mock;
  };
  let access: {
    assertSchoolExists: jest.Mock;
    assertCanManageSchool: jest.Mock;
  };
  let audit: { log: jest.Mock };
  let useCase: DeleteSchoolLocationUseCase;

  const school = School.create({
    id: schoolId,
    name: 'Colégio Horizonte',
    slug: SchoolSlug.create('colegio-horizonte'),
    ownerUserId: actorUserId,
  });

  const location = SchoolLocation.create({
    id: 'loc-1',
    schoolId,
    province: 'Luanda',
    municipality: 'Belas',
  });

  beforeEach(() => {
    locations = {
      findBySchoolId: jest.fn().mockResolvedValue(location),
      deleteBySchoolId: jest.fn().mockResolvedValue(true),
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
    useCase = new DeleteSchoolLocationUseCase(
      locations as never,
      access as unknown as SchoolAccessAuthorizer,
      audit as never,
    );
  });

  it('deletes location and audits', async () => {
    const result = await useCase.execute({ schoolId, actorUserId });
    expect(result.deleted).toBe(true);
    expect(locations.deleteBySchoolId).toHaveBeenCalledWith(schoolId);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SCHOOL_LOCATION_DELETED' }),
    );
  });

  it('throws when location missing', async () => {
    locations.findBySchoolId.mockResolvedValue(null);
    await expect(
      useCase.execute({ schoolId, actorUserId }),
    ).rejects.toBeInstanceOf(SchoolLocationNotFoundException);
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
