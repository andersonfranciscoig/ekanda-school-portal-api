import { School } from '../../domain/aggregates/school.aggregate';
import { SchoolPricing } from '../../domain/entities/school-pricing.entity';
import {
  SchoolAccessDeniedException,
  SchoolPriceNotFoundException,
} from '../../domain/exceptions/school.exceptions';
import {
  EducationLevelCode,
  SchoolMembershipRole,
} from '../../domain/school.enums';
import { SchoolSlug } from '../../domain/value-objects/school-slug.vo';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';
import { DeleteSchoolPriceUseCase } from './delete-school-price.use-case';

describe('DeleteSchoolPriceUseCase', () => {
  const schoolId = '11111111-1111-1111-1111-111111111111';
  const actorUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  let prices: {
    findBySchoolId: jest.Mock;
    deleteBySchoolId: jest.Mock;
  };
  let access: {
    assertSchoolExists: jest.Mock;
    assertCanManageSchool: jest.Mock;
  };
  let audit: { log: jest.Mock };
  let useCase: DeleteSchoolPriceUseCase;

  const school = School.create({
    id: schoolId,
    name: 'Colégio Horizonte',
    slug: SchoolSlug.create('colegio-horizonte'),
    ownerUserId: actorUserId,
  });

  const pricing = SchoolPricing.create({
    id: 'price-1',
    schoolId,
    levels: [
      {
        levelId: EducationLevelCode.CRECHE,
        enrollmentFee: { min: 1000, max: 2000 },
        tuitionFee: { min: 3000, max: 4000 },
        transportFee: { min: null, max: null },
        mealFee: { min: null, max: null },
      },
    ],
    otherFees: 500,
    currency: 'AOA',
  });

  beforeEach(() => {
    prices = {
      findBySchoolId: jest.fn().mockResolvedValue(pricing),
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
    useCase = new DeleteSchoolPriceUseCase(
      prices as never,
      access as unknown as SchoolAccessAuthorizer,
      audit as never,
    );
  });

  it('deletes prices and audits', async () => {
    const result = await useCase.execute({ schoolId, actorUserId });
    expect(result.deleted).toBe(true);
    expect(prices.deleteBySchoolId).toHaveBeenCalledWith(schoolId);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SCHOOL_PRICES_DELETED' }),
    );
  });

  it('throws when price missing', async () => {
    prices.findBySchoolId.mockResolvedValue(null);
    await expect(
      useCase.execute({ schoolId, actorUserId }),
    ).rejects.toBeInstanceOf(SchoolPriceNotFoundException);
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
