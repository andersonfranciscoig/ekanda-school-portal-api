import { School } from '../../domain/aggregates/school.aggregate';
import {
  SchoolAccessDeniedException,
  SchoolEducationLevelsNotFoundException,
} from '../../domain/exceptions/school.exceptions';
import {
  EducationLevelCode,
  SchoolMembershipRole,
} from '../../domain/school.enums';
import { SchoolSlug } from '../../domain/value-objects/school-slug.vo';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';
import { DeleteSchoolEducationLevelsUseCase } from './delete-school-education-levels.use-case';

describe('DeleteSchoolEducationLevelsUseCase', () => {
  const schoolId = '11111111-1111-1111-1111-111111111111';
  const actorUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  let educationLevels: {
    findBySchoolId: jest.Mock;
    sync: jest.Mock;
  };
  let access: {
    assertSchoolExists: jest.Mock;
    assertCanManageSchool: jest.Mock;
  };
  let audit: { log: jest.Mock };
  let useCase: DeleteSchoolEducationLevelsUseCase;

  const school = School.create({
    id: schoolId,
    name: 'Colégio Horizonte',
    slug: SchoolSlug.create('colegio-horizonte'),
    ownerUserId: actorUserId,
  });

  beforeEach(() => {
    educationLevels = {
      findBySchoolId: jest
        .fn()
        .mockResolvedValue([EducationLevelCode.CRECHE, EducationLevelCode.PRIMARIO]),
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
    useCase = new DeleteSchoolEducationLevelsUseCase(
      educationLevels as never,
      access as unknown as SchoolAccessAuthorizer,
      audit as never,
    );
  });

  it('clears all education levels', async () => {
    const result = await useCase.execute({ schoolId, actorUserId });
    expect(result.deleted).toBe(true);
    expect(result.levels).toEqual([]);
    expect(educationLevels.sync).toHaveBeenCalledWith(schoolId, []);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SCHOOL_EDUCATION_LEVELS_DELETED' }),
    );
  });

  it('throws when no levels exist', async () => {
    educationLevels.findBySchoolId.mockResolvedValue([]);
    await expect(
      useCase.execute({ schoolId, actorUserId }),
    ).rejects.toBeInstanceOf(SchoolEducationLevelsNotFoundException);
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
