import { Money } from '../../../../shared/domain/value-objects/money.vo';
import { School } from '../../../school/domain/aggregates/school.aggregate';
import { SchoolNotFoundException } from '../../../school/domain/exceptions/school.exceptions';
import { SchoolStatus } from '../../../school/domain/school.enums';
import { SchoolSlug } from '../../../school/domain/value-objects/school-slug.vo';
import {
  Subscription,
  SubscriptionStatus,
} from '../../domain/aggregates/subscription.aggregate';
import { Plan, PlanCode } from '../../domain/entities/plan.entity';
import { PlanFeatureCode } from '../../domain/plan-feature-codes';
import { ActivateSchoolFreePlanUseCase } from './activate-school-free-plan.use-case';

describe('ActivateSchoolFreePlanUseCase', () => {
  const schoolId = '11111111-1111-1111-1111-111111111111';
  const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const now = new Date('2026-08-10T10:00:00.000Z');

  const freePlan = Plan.rehydrate({
    id: 'plan-free',
    code: PlanCode.FREE,
    name: 'Plano Gratuito',
    description: null,
    price: Money.create(0, 'AOA'),
    billingPeriod: 'ONE_TIME',
    isActive: true,
    isPublic: true,
    featureCodes: [PlanFeatureCode.PUBLIC_PROFILE],
  });

  let schools: { findById: jest.Mock; save: jest.Mock };
  let plans: { findByCode: jest.Mock; findById: jest.Mock };
  let subscriptions: {
    findFreeBySchoolId: jest.Mock;
    findValidActiveBySchoolId: jest.Mock;
    save: jest.Mock;
    countPaymentsBySubscriptionId: jest.Mock;
  };
  let useCase: ActivateSchoolFreePlanUseCase;
  let school: School;

  beforeEach(() => {
    school = School.create({
      id: schoolId,
      name: 'Colégio Horizonte',
      slug: SchoolSlug.create('colegio-horizonte'),
      ownerUserId: userId,
      description: 'Descrição',
    });
    schools = {
      findById: jest.fn().mockResolvedValue(school),
      save: jest.fn().mockResolvedValue(undefined),
    };
    plans = {
      findByCode: jest.fn().mockResolvedValue(freePlan),
      findById: jest.fn(),
    };
    subscriptions = {
      findFreeBySchoolId: jest.fn().mockResolvedValue(null),
      findValidActiveBySchoolId: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
      countPaymentsBySubscriptionId: jest.fn().mockResolvedValue(0),
    };
    useCase = new ActivateSchoolFreePlanUseCase(
      schools as never,
      plans as never,
      subscriptions as never,
    );
  });

  it('cria FREE ACTIVE por 30 dias e School ACTIVE (cenário 1)', async () => {
    const result = await useCase.execute({ schoolId, now });

    expect(result.created).toBe(true);
    expect(result.schoolStatus).toBe(SchoolStatus.ACTIVE);
    expect(result.subscription.planCode).toBe(PlanCode.FREE);
    expect(result.subscription.status).toBe(SubscriptionStatus.ACTIVE);
    expect(result.subscription.isFree).toBe(true);
    expect(result.subscription.isExpired).toBe(false);
    expect(result.subscription.startDate).toBe(now.toISOString());
    expect(result.subscription.endDate).toBe(
      new Date('2026-09-09T10:00:00.000Z').toISOString(),
    );
    expect(result.subscription.daysRemaining).toBe(30);
    expect(subscriptions.save).toHaveBeenCalledTimes(1);
    expect(schools.save).toHaveBeenCalledTimes(1);

    const savedSub = subscriptions.save.mock.calls[0][0] as Subscription;
    expect(savedSub.autoRenew).toBe(false);
    expect(await subscriptions.countPaymentsBySubscriptionId(savedSub.id)).toBe(
      0,
    );
  });

  it('é idempotente — não cria segunda FREE (cenário 2)', async () => {
    const existing = Subscription.createFreePlan({
      id: 'existing-free',
      schoolId,
      planId: freePlan.id,
      startDate: now,
    });
    school.activateWithFreePlan();
    subscriptions.findFreeBySchoolId.mockResolvedValue(existing);

    const result = await useCase.execute({ schoolId, now });

    expect(result.created).toBe(false);
    expect(subscriptions.save).not.toHaveBeenCalled();
    expect(result.subscription.planCode).toBe(PlanCode.FREE);
  });

  it('não cria Payment (cenário 6)', async () => {
    await useCase.execute({ schoolId, now });
    expect(subscriptions.countPaymentsBySubscriptionId).toBeDefined();
    const savedSub = subscriptions.save.mock.calls[0][0] as Subscription;
    expect(
      await subscriptions.countPaymentsBySubscriptionId(savedSub.id),
    ).toBe(0);
  });

  it('não afecta escola com PRESENCE activo (cenário 5)', async () => {
    const presencePlan = Plan.rehydrate({
      id: 'plan-presence',
      code: PlanCode.PRESENCE,
      name: 'Presença',
      description: null,
      price: Money.create(0, 'Kz'),
      billingPeriod: 'MONTHLY',
      isActive: true,
      isPublic: true,
      featureCodes: [PlanFeatureCode.PUBLIC_PROFILE],
    });
    const presenceSub = Subscription.rehydrate({
      id: 'sub-presence',
      schoolId,
      planId: presencePlan.id,
      status: SubscriptionStatus.ACTIVE,
      startDate: now,
      endDate: null,
      autoRenew: true,
    });
    subscriptions.findValidActiveBySchoolId.mockResolvedValue(presenceSub);
    plans.findById.mockResolvedValue(presencePlan);
    (school as unknown as { _status: SchoolStatus })._status =
      SchoolStatus.ACTIVE;

    const result = await useCase.execute({ schoolId, now });

    expect(result.created).toBe(false);
    expect(result.subscription.planCode).toBe(PlanCode.PRESENCE);
    expect(result.subscription.isFree).toBe(false);
    expect(subscriptions.save).not.toHaveBeenCalled();
  });

  it('rejeita school inexistente', async () => {
    schools.findById.mockResolvedValue(null);
    await expect(useCase.execute({ schoolId, now })).rejects.toBeInstanceOf(
      SchoolNotFoundException,
    );
  });
});
