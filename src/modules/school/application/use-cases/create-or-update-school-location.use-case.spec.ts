import { School } from '../../domain/aggregates/school.aggregate';
import { SchoolLocation } from '../../domain/entities/school-location.entity';
import {
  InvalidSchoolLocationException,
  SchoolAccessDeniedException,
  SchoolLocationAccessDeniedException,
  SchoolLocationNotFoundException,
  SchoolNotFoundException,
} from '../../domain/exceptions/school.exceptions';
import { SchoolMembershipRole } from '../../domain/school.enums';
import { SchoolSlug } from '../../domain/value-objects/school-slug.vo';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';
import {
  CreateOrUpdateSchoolLocationUseCase,
} from './create-or-update-school-location.use-case';

describe('CreateOrUpdateSchoolLocationUseCase', () => {
  const schoolId = '11111111-1111-1111-1111-111111111111';
  const otherSchoolId = '22222222-2222-2222-2222-222222222222';
  const actorUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const locationId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  let locations: {
    findById: jest.Mock;
    findBySchoolId: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  let access: {
    assertSchoolExists: jest.Mock;
    assertCanManageSchool: jest.Mock;
  };
  let useCase: CreateOrUpdateSchoolLocationUseCase;

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
    locations = {
      findById: jest.fn(),
      findBySchoolId: jest.fn(),
      create: jest.fn(async (loc: SchoolLocation) => loc),
      update: jest.fn(async (loc: SchoolLocation) => loc),
    };
    access = {
      assertSchoolExists: jest.fn().mockResolvedValue(school),
      assertCanManageSchool: jest.fn().mockResolvedValue(membership),
    };
    useCase = new CreateOrUpdateSchoolLocationUseCase(
      locations as never,
      access as unknown as SchoolAccessAuthorizer,
    );
  });

  const baseInput = {
    schoolId,
    province: 'Luanda',
    municipality: 'Belas',
    neighborhood: 'Talatona',
    address: 'Rua 21 de Janeiro, nº 45',
    latitude: null as number | null,
    longitude: null as number | null,
    actorUserId,
  };

  describe('CREATE', () => {
    it('creates location with valid data', async () => {
      locations.findBySchoolId.mockResolvedValue(null);

      const result = await useCase.execute(baseInput);

      expect(result.operation).toBe('created');
      expect(result.location.schoolId).toBe(schoolId);
      expect(result.location.toSnapshot()).toMatchObject({
        schoolId,
        province: 'Luanda',
        municipality: 'Belas',
        neighborhood: 'Talatona',
        address: 'Rua 21 de Janeiro, nº 45',
        latitude: null,
        longitude: null,
      });
      expect(locations.create).toHaveBeenCalled();
      expect(access.assertSchoolExists).toHaveBeenCalledWith(schoolId);
      expect(access.assertCanManageSchool).toHaveBeenCalledWith(
        actorUserId,
        schoolId,
      );
    });

    it('rejects when school does not exist', async () => {
      access.assertSchoolExists.mockRejectedValue(new SchoolNotFoundException());

      await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
        SchoolNotFoundException,
      );
      expect(locations.create).not.toHaveBeenCalled();
    });

    it('rejects user without membership', async () => {
      access.assertCanManageSchool.mockRejectedValue(
        new SchoolAccessDeniedException(),
      );

      await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
        SchoolAccessDeniedException,
      );
    });

    it('rejects non-ACTIVE membership via authorizer', async () => {
      access.assertCanManageSchool.mockRejectedValue(
        new SchoolAccessDeniedException(),
      );

      await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
        SchoolAccessDeniedException,
      );
    });

    it('updates existing location when id is omitted', async () => {
      const existing = SchoolLocation.create({
        id: locationId,
        schoolId,
        province: 'Luanda',
        municipality: 'Belas',
      });
      locations.findBySchoolId.mockResolvedValue(existing);
      locations.findById.mockResolvedValue(existing);

      const result = await useCase.execute(baseInput);

      expect(result.operation).toBe('updated');
      expect(result.location.id).toBe(locationId);
      expect(locations.update).toHaveBeenCalled();
      expect(locations.create).not.toHaveBeenCalled();
    });

    it('accepts null latitude/longitude', async () => {
      locations.findBySchoolId.mockResolvedValue(null);

      const result = await useCase.execute({
        ...baseInput,
        latitude: null,
        longitude: null,
      });

      expect(result.location.coordinates).toBeNull();
    });

    it('rejects invalid latitude', async () => {
      locations.findBySchoolId.mockResolvedValue(null);

      await expect(
        useCase.execute({
          ...baseInput,
          latitude: 100,
          longitude: 13,
        }),
      ).rejects.toBeInstanceOf(InvalidSchoolLocationException);
    });

    it('rejects invalid longitude', async () => {
      locations.findBySchoolId.mockResolvedValue(null);

      await expect(
        useCase.execute({
          ...baseInput,
          latitude: -8,
          longitude: 200,
        }),
      ).rejects.toBeInstanceOf(InvalidSchoolLocationException);
    });
  });

  describe('UPDATE', () => {
    const existing = SchoolLocation.create({
      id: locationId,
      schoolId,
      province: 'Luanda',
      municipality: 'Viana',
      neighborhood: 'Zango',
      address: 'Rua Antiga',
    });

    it('updates existing location', async () => {
      locations.findById.mockResolvedValue(existing);

      const result = await useCase.execute({
        ...baseInput,
        id: locationId,
        municipality: 'Belas',
        neighborhood: 'Talatona',
        address: 'Rua Nova',
      });

      expect(result.operation).toBe('updated');
      expect(result.location.toSnapshot()).toMatchObject({
        id: locationId,
        municipality: 'Belas',
        neighborhood: 'Talatona',
        address: 'Rua Nova',
      });
      expect(locations.update).toHaveBeenCalled();
    });

    it('rejects missing location', async () => {
      locations.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({ ...baseInput, id: locationId }),
      ).rejects.toBeInstanceOf(SchoolLocationNotFoundException);
    });

    it('rejects location belonging to another school', async () => {
      locations.findById.mockResolvedValue(
        SchoolLocation.create({
          id: locationId,
          schoolId: otherSchoolId,
          province: 'Luanda',
          municipality: 'Belas',
        }),
      );

      await expect(
        useCase.execute({ ...baseInput, id: locationId }),
      ).rejects.toBeInstanceOf(SchoolLocationAccessDeniedException);
      expect(locations.update).not.toHaveBeenCalled();
    });

    it('rejects user without access on update', async () => {
      access.assertCanManageSchool.mockRejectedValue(
        new SchoolAccessDeniedException(),
      );

      await expect(
        useCase.execute({ ...baseInput, id: locationId }),
      ).rejects.toBeInstanceOf(SchoolAccessDeniedException);
    });

    it('does not allow changing id via update payload identity', async () => {
      locations.findById.mockResolvedValue(existing);

      const result = await useCase.execute({
        ...baseInput,
        id: locationId,
        province: 'Benguela',
        municipality: 'Lobito',
      });

      expect(result.location.id).toBe(locationId);
      expect(result.location.schoolId).toBe(schoolId);
    });
  });

  describe('security', () => {
    it('uses actorUserId from auth context for authorization', async () => {
      locations.findBySchoolId.mockResolvedValue(null);

      await useCase.execute(baseInput);

      expect(access.assertCanManageSchool).toHaveBeenCalledWith(
        actorUserId,
        schoolId,
      );
    });

    it('blocks cross-tenant location update via schoolId mismatch', async () => {
      locations.findById.mockResolvedValue(
        SchoolLocation.create({
          id: locationId,
          schoolId,
          province: 'Luanda',
          municipality: 'Belas',
        }),
      );

      await expect(
        useCase.execute({
          ...baseInput,
          id: locationId,
          schoolId: otherSchoolId,
        }),
      ).rejects.toBeInstanceOf(SchoolLocationAccessDeniedException);
    });
  });
});
