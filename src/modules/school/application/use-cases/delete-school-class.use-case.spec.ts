import { School } from '../../domain/aggregates/school.aggregate';
import { SchoolClass } from '../../domain/entities/school-class.entity';
import {
  SchoolAccessDeniedException,
  SchoolClassAccessDeniedException,
  SchoolClassNotFoundException,
} from '../../domain/exceptions/school.exceptions';
import { SchoolClassShift, SchoolMembershipRole } from '../../domain/school.enums';
import { SchoolSlug } from '../../domain/value-objects/school-slug.vo';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';
import { DeleteSchoolClassUseCase } from './delete-school-class.use-case';

describe('DeleteSchoolClassUseCase', () => {
  const schoolId = '11111111-1111-1111-1111-111111111111';
  const otherSchoolId = '22222222-2222-2222-2222-222222222222';
  const actorUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const classId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  let classes: { findById: jest.Mock; update: jest.Mock };
  let access: {
    assertSchoolExists: jest.Mock;
    assertCanManageSchool: jest.Mock;
  };
  let audit: { log: jest.Mock };
  let useCase: DeleteSchoolClassUseCase;

  const school = School.create({
    id: schoolId,
    name: 'Colégio Horizonte',
    slug: SchoolSlug.create('colegio-horizonte'),
    ownerUserId: actorUserId,
  });

  const existingClass = SchoolClass.rehydrate({
    id: classId,
    schoolId,
    classLabel: '7.ª',
    vacancies: 24,
    shift: SchoolClassShift.MORNING,
    schedule: '07h30 – 12h30',
    isActive: true,
  });

  beforeEach(() => {
    classes = {
      findById: jest.fn().mockResolvedValue(existingClass),
      update: jest.fn(async (c: SchoolClass) => c),
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
    useCase = new DeleteSchoolClassUseCase(
      classes as never,
      access as unknown as SchoolAccessAuthorizer,
      audit as never,
    );
  });

  it('soft-deletes class (isActive=false)', async () => {
    const result = await useCase.execute({
      schoolId,
      classId,
      actorUserId,
    });
    expect(result.isActive).toBe(false);
    expect(existingClass.isActive).toBe(false);
    expect(classes.update).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SCHOOL_CLASS_DELETED',
        metadata: expect.objectContaining({ softDelete: true }),
      }),
    );
  });

  it('rejects class from another school', async () => {
    classes.findById.mockResolvedValue(
      SchoolClass.rehydrate({
        ...existingClass.toSnapshot(),
        schoolId: otherSchoolId,
        isActive: true,
      }),
    );
    await expect(
      useCase.execute({ schoolId, classId, actorUserId }),
    ).rejects.toBeInstanceOf(SchoolClassAccessDeniedException);
  });

  it('rejects missing class', async () => {
    classes.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({ schoolId, classId, actorUserId }),
    ).rejects.toBeInstanceOf(SchoolClassNotFoundException);
  });

  it('rejects unauthorized actor', async () => {
    access.assertCanManageSchool.mockRejectedValue(
      new SchoolAccessDeniedException(),
    );
    await expect(
      useCase.execute({ schoolId, classId, actorUserId }),
    ).rejects.toBeInstanceOf(SchoolAccessDeniedException);
  });
});
