import { School } from '../../domain/aggregates/school.aggregate';
import {
  DuplicateEducationLevelException,
  InvalidEducationLevelException,
  SchoolAccessDeniedException,
  SchoolNotFoundException,
} from '../../domain/exceptions/school.exceptions';
import { EducationLevelCode, SchoolMembershipRole } from '../../domain/school.enums';
import { SchoolSlug } from '../../domain/value-objects/school-slug.vo';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';
import { SyncSchoolEducationLevelsUseCase } from './sync-school-education-levels.use-case';

describe('SyncSchoolEducationLevelsUseCase', () => {
  const schoolId = '11111111-1111-1111-1111-111111111111';
  const otherSchoolId = '22222222-2222-2222-2222-222222222222';
  const actorUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  let educationLevels: {
    findBySchoolId: jest.Mock;
    sync: jest.Mock;
  };
  let access: {
    assertSchoolExists: jest.Mock;
    assertCanManageSchool: jest.Mock;
  };
  let useCase: SyncSchoolEducationLevelsUseCase;

  const school = School.create({
    id: schoolId,
    name: 'Colégio Horizonte',
    slug: SchoolSlug.create('colegio-horizonte'),
    ownerUserId: actorUserId,
  });

  const membership = {
    userId: actorUserId,
    schoolId,
    role: SchoolMembershipRole.OWNER,
    status: 'ACTIVE',
  };

  beforeEach(() => {
    educationLevels = {
      findBySchoolId: jest.fn(),
      sync: jest.fn(async (_id: string, levels: EducationLevelCode[]) => levels),
    };
    access = {
      assertSchoolExists: jest.fn().mockResolvedValue(school),
      assertCanManageSchool: jest.fn().mockResolvedValue(membership),
    };
    useCase = new SyncSchoolEducationLevelsUseCase(
      educationLevels as never,
      access as unknown as SchoolAccessAuthorizer,
    );
  });

  it('creates levels when school has none', async () => {
    const result = await useCase.execute({
      schoolId,
      actorUserId,
      levels: ['primario', 'i_ciclo'],
    });

    expect(result.levels).toEqual([
      EducationLevelCode.PRIMARIO,
      EducationLevelCode.I_CICLO,
    ]);
    expect(educationLevels.sync).toHaveBeenCalledWith(schoolId, [
      EducationLevelCode.PRIMARIO,
      EducationLevelCode.I_CICLO,
    ]);
  });

  it('keeps existing levels when request matches', async () => {
    const levels = [EducationLevelCode.PRIMARIO, EducationLevelCode.I_CICLO];
    educationLevels.sync.mockResolvedValue(levels);

    const result = await useCase.execute({
      schoolId,
      actorUserId,
      levels: ['primario', 'i_ciclo'],
    });

    expect(result.levels).toEqual(levels);
  });

  it('adds new levels via sync desired state', async () => {
    await useCase.execute({
      schoolId,
      actorUserId,
      levels: ['primario', 'medio'],
    });

    expect(educationLevels.sync).toHaveBeenCalledWith(schoolId, [
      EducationLevelCode.PRIMARIO,
      EducationLevelCode.MEDIO,
    ]);
  });

  it('removes levels missing from request', async () => {
    await useCase.execute({
      schoolId,
      actorUserId,
      levels: ['primario'],
    });

    expect(educationLevels.sync).toHaveBeenCalledWith(schoolId, [
      EducationLevelCode.PRIMARIO,
    ]);
  });

  it('synchronizes a full replacement', async () => {
    const result = await useCase.execute({
      schoolId,
      actorUserId,
      levels: ['creche', 'medio'],
    });

    expect(result).toEqual({
      schoolId,
      levels: [EducationLevelCode.CRECHE, EducationLevelCode.MEDIO],
    });
  });

  it('accepts empty levels array', async () => {
    educationLevels.sync.mockResolvedValue([]);

    const result = await useCase.execute({
      schoolId,
      actorUserId,
      levels: [],
    });

    expect(result.levels).toEqual([]);
    expect(educationLevels.sync).toHaveBeenCalledWith(schoolId, []);
  });

  it('empty levels clears all (sync called with empty)', async () => {
    await useCase.execute({ schoolId, actorUserId, levels: [] });
    expect(educationLevels.sync).toHaveBeenCalledWith(schoolId, []);
  });

  it('rejects school not found', async () => {
    access.assertSchoolExists.mockRejectedValue(new SchoolNotFoundException());

    await expect(
      useCase.execute({ schoolId, actorUserId, levels: ['primario'] }),
    ).rejects.toBeInstanceOf(SchoolNotFoundException);
    expect(educationLevels.sync).not.toHaveBeenCalled();
  });

  it('rejects user without membership', async () => {
    access.assertCanManageSchool.mockRejectedValue(
      new SchoolAccessDeniedException(),
    );

    await expect(
      useCase.execute({ schoolId, actorUserId, levels: ['primario'] }),
    ).rejects.toBeInstanceOf(SchoolAccessDeniedException);
  });

  it('rejects INVITED membership via authorizer', async () => {
    access.assertCanManageSchool.mockRejectedValue(
      new SchoolAccessDeniedException(),
    );

    await expect(
      useCase.execute({ schoolId, actorUserId, levels: ['primario'] }),
    ).rejects.toBeInstanceOf(SchoolAccessDeniedException);
  });

  it('rejects SUSPENDED membership via authorizer', async () => {
    access.assertCanManageSchool.mockRejectedValue(
      new SchoolAccessDeniedException(),
    );

    await expect(
      useCase.execute({ schoolId, actorUserId, levels: ['primario'] }),
    ).rejects.toBeInstanceOf(SchoolAccessDeniedException);
  });

  it('rejects REMOVED membership via authorizer', async () => {
    access.assertCanManageSchool.mockRejectedValue(
      new SchoolAccessDeniedException(),
    );

    await expect(
      useCase.execute({ schoolId, actorUserId, levels: ['primario'] }),
    ).rejects.toBeInstanceOf(SchoolAccessDeniedException);
  });

  it('rejects user without OWNER/ADMIN role via authorizer', async () => {
    access.assertCanManageSchool.mockRejectedValue(
      new SchoolAccessDeniedException('Insufficient permission for this school'),
    );

    await expect(
      useCase.execute({ schoolId, actorUserId, levels: ['primario'] }),
    ).rejects.toBeInstanceOf(SchoolAccessDeniedException);
  });

  it('rejects invalid level', async () => {
    await expect(
      useCase.execute({
        schoolId,
        actorUserId,
        levels: ['Primário'],
      }),
    ).rejects.toBeInstanceOf(InvalidEducationLevelException);
    expect(educationLevels.sync).not.toHaveBeenCalled();
  });

  it('rejects duplicate levels', async () => {
    await expect(
      useCase.execute({
        schoolId,
        actorUserId,
        levels: ['primario', 'primario'],
      }),
    ).rejects.toBeInstanceOf(DuplicateEducationLevelException);
    expect(educationLevels.sync).not.toHaveBeenCalled();
  });

  it('does not persist when sync fails (atomicity surface)', async () => {
    educationLevels.sync.mockRejectedValue(new Error('tx failed'));

    await expect(
      useCase.execute({
        schoolId,
        actorUserId,
        levels: ['primario', 'medio'],
      }),
    ).rejects.toThrow('tx failed');
  });

  it('blocks cross-tenant sync (School A actor cannot manage School B)', async () => {
    access.assertCanManageSchool.mockRejectedValue(
      new SchoolAccessDeniedException(),
    );

    await expect(
      useCase.execute({
        schoolId: otherSchoolId,
        actorUserId,
        levels: ['primario'],
      }),
    ).rejects.toBeInstanceOf(SchoolAccessDeniedException);

    expect(access.assertCanManageSchool).toHaveBeenCalledWith(
      actorUserId,
      otherSchoolId,
    );
    expect(educationLevels.sync).not.toHaveBeenCalled();
  });

  it('uses actorUserId from auth context', async () => {
    await useCase.execute({
      schoolId,
      actorUserId,
      levels: ['creche'],
    });

    expect(access.assertCanManageSchool).toHaveBeenCalledWith(
      actorUserId,
      schoolId,
    );
  });

  it('returns levels in catalog order regardless of request order', async () => {
    const result = await useCase.execute({
      schoolId,
      actorUserId,
      levels: ['medio', 'creche', 'primario'],
    });

    expect(result.levels).toEqual([
      EducationLevelCode.CRECHE,
      EducationLevelCode.PRIMARIO,
      EducationLevelCode.MEDIO,
    ]);
  });
});
