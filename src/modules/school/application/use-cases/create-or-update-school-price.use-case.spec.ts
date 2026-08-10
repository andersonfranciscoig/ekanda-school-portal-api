import { School } from '../../domain/aggregates/school.aggregate';
import { SchoolPricing } from '../../domain/entities/school-pricing.entity';
import {
  DuplicateEducationLevelException,
  EducationLevelNotOfferedBySchoolException,
  InvalidCurrencyException,
  InvalidEducationLevelException,
  InvalidPriceRangeException,
  SchoolAccessDeniedException,
  SchoolNotFoundException,
  SchoolPriceNotFoundException,
  SchoolPriceAccessDeniedException,
} from '../../domain/exceptions/school.exceptions';
import {
  EducationLevelCode,
  SchoolMembershipRole,
} from '../../domain/school.enums';
import { SchoolSlug } from '../../domain/value-objects/school-slug.vo';
import { SchoolAccessAuthorizer } from '../services/school-access.authorizer';
import { CreateOrUpdateSchoolPriceUseCase } from './create-or-update-school-price.use-case';

describe('CreateOrUpdateSchoolPriceUseCase', () => {
  const schoolId = '11111111-1111-1111-1111-111111111111';
  const actorUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const priceId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  let prices: {
    findById: jest.Mock;
    findBySchoolId: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  let educationLevels: {
    findBySchoolId: jest.Mock;
    sync: jest.Mock;
  };
  let access: {
    assertSchoolExists: jest.Mock;
    assertCanManageSchool: jest.Mock;
  };
  let useCase: CreateOrUpdateSchoolPriceUseCase;

  const school = School.create({
    id: schoolId,
    name: 'Colégio Horizonte',
    slug: SchoolSlug.create('colegio-horizonte'),
    ownerUserId: actorUserId,
  });

  const offered = [
    EducationLevelCode.CRECHE,
    EducationLevelCode.PRIMARIO,
    EducationLevelCode.I_CICLO,
  ];

  const baseLevels = [
    {
      levelId: 'creche',
      enrollmentFee: { min: '40000', max: '55000' },
      tuitionFee: { min: '35000', max: '45000' },
      transportFee: { min: '10000', max: '15000' },
      mealFee: { min: '8000', max: '12000' },
    },
  ];

  beforeEach(() => {
    prices = {
      findById: jest.fn(),
      findBySchoolId: jest.fn().mockResolvedValue(null),
      create: jest.fn(async (p: SchoolPricing) => p),
      update: jest.fn(async (p: SchoolPricing) => p),
    };
    educationLevels = {
      findBySchoolId: jest.fn().mockResolvedValue(offered),
      sync: jest.fn(),
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
    useCase = new CreateOrUpdateSchoolPriceUseCase(
      prices as never,
      educationLevels as never,
      access as unknown as SchoolAccessAuthorizer,
    );
  });

  it('creates prices for offered levels', async () => {
    const result = await useCase.execute({
      schoolId,
      actorUserId,
      levels: baseLevels,
      otherFees: '5000',
      currency: 'AOA',
    });

    expect(result.operation).toBe('created');
    expect(result.pricing.toSnapshot()).toMatchObject({
      schoolId,
      otherFees: 5000,
      currency: 'AOA',
      levels: [
        {
          levelId: EducationLevelCode.CRECHE,
          enrollmentFee: { min: 40000, max: 55000 },
        },
      ],
    });
    expect(prices.create).toHaveBeenCalled();
  });

  it('rejects level not offered by school', async () => {
    await expect(
      useCase.execute({
        schoolId,
        actorUserId,
        levels: [
          ...baseLevels,
          {
            levelId: 'medio',
            enrollmentFee: { min: 1, max: 2 },
            tuitionFee: {},
            transportFee: {},
            mealFee: {},
          },
        ],
      }),
    ).rejects.toBeInstanceOf(EducationLevelNotOfferedBySchoolException);
    expect(prices.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate levels', async () => {
    await expect(
      useCase.execute({
        schoolId,
        actorUserId,
        levels: [baseLevels[0], { ...baseLevels[0] }],
      }),
    ).rejects.toBeInstanceOf(DuplicateEducationLevelException);
  });

  it('rejects invalid level id', async () => {
    await expect(
      useCase.execute({
        schoolId,
        actorUserId,
        levels: [
          {
            levelId: 'piscina',
            enrollmentFee: {},
            tuitionFee: {},
            transportFee: {},
            mealFee: {},
          },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidEducationLevelException);
  });

  it('rejects min > max', async () => {
    await expect(
      useCase.execute({
        schoolId,
        actorUserId,
        levels: [
          {
            levelId: 'creche',
            enrollmentFee: { min: 100, max: 50 },
            tuitionFee: {},
            transportFee: {},
            mealFee: {},
          },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidPriceRangeException);
  });

  it('rejects invalid currency', async () => {
    await expect(
      useCase.execute({
        schoolId,
        actorUserId,
        levels: baseLevels,
        currency: 'USD',
      }),
    ).rejects.toBeInstanceOf(InvalidCurrencyException);
  });

  it('upserts when price already exists without id', async () => {
    const existing = SchoolPricing.rehydrate({
      id: priceId,
      schoolId,
      levels: [],
      otherFees: null,
      currency: 'AOA',
    });
    prices.findBySchoolId.mockResolvedValue(existing);
    prices.findById.mockResolvedValue(existing);

    const result = await useCase.execute({
      schoolId,
      actorUserId,
      levels: baseLevels,
    });

    expect(result.operation).toBe('updated');
    expect(prices.update).toHaveBeenCalled();
    expect(prices.create).not.toHaveBeenCalled();
  });

  it('updates existing price by id', async () => {
    const existing = SchoolPricing.rehydrate({
      id: priceId,
      schoolId,
      levels: [],
      otherFees: null,
      currency: 'AOA',
    });
    prices.findById.mockResolvedValue(existing);

    const result = await useCase.execute({
      id: priceId,
      schoolId,
      actorUserId,
      levels: baseLevels,
      otherFees: 1000,
    });

    expect(result.operation).toBe('updated');
    expect(prices.update).toHaveBeenCalled();
    expect(prices.create).not.toHaveBeenCalled();
  });

  it('rejects update when price not found', async () => {
    prices.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({
        id: priceId,
        schoolId,
        actorUserId,
        levels: baseLevels,
      }),
    ).rejects.toBeInstanceOf(SchoolPriceNotFoundException);
  });

  it('rejects cross-school price update', async () => {
    prices.findById.mockResolvedValue(
      SchoolPricing.rehydrate({
        id: priceId,
        schoolId: '22222222-2222-2222-2222-222222222222',
        levels: [],
        otherFees: null,
        currency: 'AOA',
      }),
    );

    await expect(
      useCase.execute({
        id: priceId,
        schoolId,
        actorUserId,
        levels: baseLevels,
      }),
    ).rejects.toBeInstanceOf(SchoolPriceAccessDeniedException);
  });

  it('rejects unauthorized actor', async () => {
    access.assertCanManageSchool.mockRejectedValue(
      new SchoolAccessDeniedException(),
    );
    await expect(
      useCase.execute({ schoolId, actorUserId, levels: baseLevels }),
    ).rejects.toBeInstanceOf(SchoolAccessDeniedException);
  });

  it('rejects school not found', async () => {
    access.assertSchoolExists.mockRejectedValue(new SchoolNotFoundException());
    await expect(
      useCase.execute({ schoolId, actorUserId, levels: baseLevels }),
    ).rejects.toBeInstanceOf(SchoolNotFoundException);
  });
});
