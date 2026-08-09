import { School } from '../../domain/aggregates/school.aggregate';
import { SchoolClass } from '../../domain/entities/school-class.entity';
import {
  InvalidSchoolClassException,
  SchoolAccessDeniedException,
  SchoolClassAccessDeniedException,
  SchoolClassNotFoundException,
  SchoolNotFoundException,
} from '../../domain/exceptions/school.exceptions';
import { SchoolClassShift, SchoolMembershipRole } from '../../domain/school.enums';
import { SchoolSlug } from '../../domain/value-objects/school-slug.vo';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';
import { CreateOrUpdateSchoolClassUseCase } from './create-or-update-school-class.use-case';

describe('CreateOrUpdateSchoolClassUseCase', () => {
  const schoolId = '11111111-1111-1111-1111-111111111111';
  const otherSchoolId = '22222222-2222-2222-2222-222222222222';
  const actorUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const classId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  let classes: {
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  let access: {
    assertSchoolExists: jest.Mock;
    assertCanManageSchool: jest.Mock;
  };
  let useCase: CreateOrUpdateSchoolClassUseCase;

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
      findById: jest.fn(),
      create: jest.fn(async (c: SchoolClass) => c),
      update: jest.fn(async (c: SchoolClass) => c),
    };
    access = {
      assertSchoolExists: jest.fn().mockResolvedValue(school),
      assertCanManageSchool: jest.fn().mockResolvedValue(membership),
    };
    useCase = new CreateOrUpdateSchoolClassUseCase(
      classes as never,
      access as unknown as SchoolAccessAuthorizer,
    );
  });

  const baseInput = {
    schoolId,
    classLabel: '7.ª',
    vacancies: 24,
    shift: SchoolClassShift.MORNING,
    schedule: '07h30 – 12h30',
    actorUserId,
  };

  describe('CREATE', () => {
    it('creates class correctly', async () => {
      const result = await useCase.execute(baseInput);

      expect(result.operation).toBe('created');
      expect(result.schoolClass.toSnapshot()).toMatchObject({
        schoolId,
        classLabel: '7.ª',
        vacancies: 24,
        shift: SchoolClassShift.MORNING,
        schedule: '07h30 – 12h30',
        isActive: true,
      });
      expect(classes.create).toHaveBeenCalled();
      expect(classes.update).not.toHaveBeenCalled();
      expect(access.assertSchoolExists).toHaveBeenCalledWith(schoolId);
      expect(access.assertCanManageSchool).toHaveBeenCalledWith(
        actorUserId,
        schoolId,
      );
    });

    it('creates class with schedule', async () => {
      const result = await useCase.execute({
        ...baseInput,
        schedule: '13h00 – 17h30',
      });

      expect(result.schoolClass.schedule).toBe('13h00 – 17h30');
    });

    it('creates class without schedule', async () => {
      const { schedule: _schedule, ...withoutSchedule } = baseInput;
      const result = await useCase.execute(withoutSchedule);

      expect(result.schoolClass.schedule).toBeNull();
    });

    it('rejects when school does not exist', async () => {
      access.assertSchoolExists.mockRejectedValue(new SchoolNotFoundException());

      await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
        SchoolNotFoundException,
      );
      expect(classes.create).not.toHaveBeenCalled();
    });

    it('rejects user without membership', async () => {
      access.assertCanManageSchool.mockRejectedValue(
        new SchoolAccessDeniedException(),
      );

      await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
        SchoolAccessDeniedException,
      );
    });

    it('rejects INVITED membership (authorizer denies)', async () => {
      access.assertCanManageSchool.mockRejectedValue(
        new SchoolAccessDeniedException(),
      );

      await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
        SchoolAccessDeniedException,
      );
    });

    it('rejects SUSPENDED membership (authorizer denies)', async () => {
      access.assertCanManageSchool.mockRejectedValue(
        new SchoolAccessDeniedException(),
      );

      await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
        SchoolAccessDeniedException,
      );
    });

    it('rejects role other than OWNER/ADMIN', async () => {
      access.assertCanManageSchool.mockRejectedValue(
        new SchoolAccessDeniedException(
          'You do not have permission to manage this school',
        ),
      );

      await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
        SchoolAccessDeniedException,
      );
    });

    it('rejects empty classLabel', async () => {
      await expect(
        useCase.execute({ ...baseInput, classLabel: '   ' }),
      ).rejects.toBeInstanceOf(InvalidSchoolClassException);
      expect(classes.create).not.toHaveBeenCalled();
    });

    it('rejects negative vacancies', async () => {
      await expect(
        useCase.execute({ ...baseInput, vacancies: -1 }),
      ).rejects.toBeInstanceOf(InvalidSchoolClassException);
    });

    it('rejects non-integer vacancies', async () => {
      await expect(
        useCase.execute({ ...baseInput, vacancies: 2.5 }),
      ).rejects.toBeInstanceOf(InvalidSchoolClassException);
    });

    it('rejects invalid shift', async () => {
      await expect(
        useCase.execute({
          ...baseInput,
          shift: 'INVALID' as SchoolClassShift,
        }),
      ).rejects.toBeInstanceOf(InvalidSchoolClassException);
    });

    it('allows zero vacancies', async () => {
      const result = await useCase.execute({ ...baseInput, vacancies: 0 });
      expect(result.schoolClass.vacancies).toBe(0);
    });
  });

  describe('UPDATE', () => {
    it('updates class correctly', async () => {
      classes.findById.mockResolvedValue(existingClass);

      const result = await useCase.execute({
        id: classId,
        schoolId,
        classLabel: '7.ª',
        vacancies: 20,
        shift: SchoolClassShift.AFTERNOON,
        schedule: '13h00 – 17h30',
        actorUserId,
      });

      expect(result.operation).toBe('updated');
      expect(result.schoolClass.toSnapshot()).toMatchObject({
        id: classId,
        schoolId,
        classLabel: '7.ª',
        vacancies: 20,
        shift: SchoolClassShift.AFTERNOON,
        schedule: '13h00 – 17h30',
      });
      expect(classes.update).toHaveBeenCalled();
      expect(classes.create).not.toHaveBeenCalled();
    });

    it('rejects when class does not exist', async () => {
      classes.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({ ...baseInput, id: classId }),
      ).rejects.toBeInstanceOf(SchoolClassNotFoundException);
      expect(classes.update).not.toHaveBeenCalled();
    });

    it('rejects class belonging to another school', async () => {
      classes.findById.mockResolvedValue(existingClass);

      await expect(
        useCase.execute({
          ...baseInput,
          id: classId,
          schoolId: otherSchoolId,
        }),
      ).rejects.toBeInstanceOf(SchoolClassAccessDeniedException);
      expect(classes.update).not.toHaveBeenCalled();
    });

    it('rejects user without authorization', async () => {
      access.assertCanManageSchool.mockRejectedValue(
        new SchoolAccessDeniedException(),
      );

      await expect(
        useCase.execute({ ...baseInput, id: classId }),
      ).rejects.toBeInstanceOf(SchoolAccessDeniedException);
    });

    it('keeps schoolId correct on update', async () => {
      classes.findById.mockResolvedValue(existingClass);

      const result = await useCase.execute({
        ...baseInput,
        id: classId,
        vacancies: 18,
      });

      expect(result.schoolClass.schoolId).toBe(schoolId);
    });

    it('does not create a new class when id is sent', async () => {
      classes.findById.mockResolvedValue(existingClass);

      await useCase.execute({ ...baseInput, id: classId });

      expect(classes.create).not.toHaveBeenCalled();
      expect(classes.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('Multi-tenancy', () => {
    it('user of school A cannot alter class of school B', async () => {
      access.assertCanManageSchool.mockRejectedValue(
        new SchoolAccessDeniedException(),
      );

      await expect(
        useCase.execute({
          ...baseInput,
          schoolId: otherSchoolId,
          id: classId,
        }),
      ).rejects.toBeInstanceOf(SchoolAccessDeniedException);
    });

    it('rejects incompatible schoolId and classId', async () => {
      access.assertSchoolExists.mockResolvedValue(school);
      access.assertCanManageSchool.mockResolvedValue({
        ...membership,
        schoolId: otherSchoolId,
      });
      classes.findById.mockResolvedValue(existingClass);

      await expect(
        useCase.execute({
          id: classId,
          schoolId: otherSchoolId,
          classLabel: '8.ª',
          vacancies: 10,
          shift: SchoolClassShift.NIGHT,
          actorUserId,
        }),
      ).rejects.toBeInstanceOf(SchoolClassAccessDeniedException);
    });
  });
});
