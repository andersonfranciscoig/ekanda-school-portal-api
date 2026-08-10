import { School } from '../../domain/aggregates/school.aggregate';
import {
  SchoolAccessDeniedException,
  SchoolNotFoundException,
} from '../../domain/exceptions/school.exceptions';
import { SchoolMembershipRole } from '../../domain/school.enums';
import { SchoolSlug } from '../../domain/value-objects/school-slug.vo';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';
import { DeleteSchoolLogoUseCase } from './delete-school-logo.use-case';

describe('DeleteSchoolLogoUseCase', () => {
  const schoolId = '11111111-1111-1111-1111-111111111111';
  const actorUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  let schools: { findById: jest.Mock; save: jest.Mock };
  let access: {
    assertSchoolExists: jest.Mock;
    assertCanManageSchool: jest.Mock;
  };
  let files: { delete: jest.Mock };
  let audit: { log: jest.Mock };
  let useCase: DeleteSchoolLogoUseCase;
  let school: School;

  beforeEach(() => {
    school = School.create({
      id: schoolId,
      name: 'Colégio Horizonte',
      slug: SchoolSlug.create('colegio-horizonte'),
      ownerUserId: actorUserId,
      logoUrl: 'https://cdn.test/logo.png',
    });
    schools = {
      findById: jest.fn().mockResolvedValue(school),
      save: jest.fn().mockResolvedValue(undefined),
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
    files = { delete: jest.fn().mockResolvedValue(undefined) };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    useCase = new DeleteSchoolLogoUseCase(
      schools as never,
      access as unknown as SchoolAccessAuthorizer,
      files as never,
      audit as never,
    );
  });

  it('clears logoUrl, deletes file and audits', async () => {
    const result = await useCase.execute({ schoolId, actorUserId });

    expect(result.logoUrl).toBeNull();
    expect(school.logoUrl).toBeNull();
    expect(schools.save).toHaveBeenCalled();
    expect(files.delete).toHaveBeenCalledWith('https://cdn.test/logo.png');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SCHOOL_LOGO_DELETED' }),
    );
  });

  it('is idempotent when logo already null', async () => {
    school.updateProfile({ logoUrl: null }, actorUserId);
    const result = await useCase.execute({ schoolId, actorUserId });
    expect(result.logoUrl).toBeNull();
    expect(schools.save).not.toHaveBeenCalled();
    expect(files.delete).not.toHaveBeenCalled();
  });

  it('rejects cross-tenant access', async () => {
    access.assertCanManageSchool.mockRejectedValue(
      new SchoolAccessDeniedException(),
    );
    await expect(
      useCase.execute({ schoolId, actorUserId }),
    ).rejects.toBeInstanceOf(SchoolAccessDeniedException);
  });

  it('rejects missing school', async () => {
    schools.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({ schoolId, actorUserId }),
    ).rejects.toBeInstanceOf(SchoolNotFoundException);
  });
});
