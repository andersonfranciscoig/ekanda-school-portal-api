import { BusinessRuleViolationException } from '../../../../shared/domain/exceptions/domain.exception';
import { Money } from '../../../../shared/domain/value-objects/money.vo';
import {
  Subscription,
  SubscriptionStatus,
} from '../../../billing/domain/aggregates/subscription.aggregate';
import { Plan, PlanCode } from '../../../billing/domain/entities/plan.entity';
import { School } from '../../../school/domain/aggregates/school.aggregate';
import { SchoolStatus } from '../../../school/domain/school.enums';
import { SchoolSlug } from '../../../school/domain/value-objects/school-slug.vo';
import { ChangeSchoolStatusUseCase } from './change-school-status.use-case';

describe('ChangeSchoolStatusUseCase', () => {
  const schoolId = '11111111-1111-1111-1111-111111111111';
  const actorUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const planId = '22222222-2222-2222-2222-222222222222';

  function makeSchool() {
    return School.create({
      id: schoolId,
      name: 'Colégio Horizonte',
      slug: SchoolSlug.create('colegio-horizonte'),
      ownerUserId: 'owner-1',
      description: 'Perfil mínimo',
    });
  }

  function makePlan() {
    return Plan.rehydrate({
      id: planId,
      code: PlanCode.PRESENCE,
      name: 'Presença',
      description: null,
      price: Money.create(150000, 'AOA'),
      billingPeriod: 'YEARLY',
      isActive: true,
      isPublic: true,
      featureCodes: ['PUBLIC_PROFILE'],
    });
  }

  function setup() {
    const school = makeSchool();
    const schools = {
      findById: jest.fn().mockResolvedValue(school),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const subscriptions = {
      findManyBySchoolId: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const plans = {
      findById: jest.fn().mockResolvedValue(makePlan()),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const useCase = new ChangeSchoolStatusUseCase(
      schools as never,
      subscriptions as never,
      plans as never,
      audit as never,
    );
    return { school, schools, subscriptions, plans, audit, useCase };
  }

  it('activates with a courtesy subscription', async () => {
    const { useCase, subscriptions, schools, audit } = setup();
    const result = await useCase.execute({
      schoolId,
      actorUserId,
      status: SchoolStatus.ACTIVE,
      planId,
      durationDays: 365,
    });

    expect(result.status).toBe(SchoolStatus.ACTIVE);
    expect(result.subscription).toMatchObject({
      planId,
      planCode: 'PRESENCE',
      planName: 'Presença',
      status: SubscriptionStatus.ACTIVE,
    });
    expect(subscriptions.save).toHaveBeenCalled();
    expect(schools.save).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SCHOOL_STATUS_CHANGED' }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ADMIN_PLAN_GRANTED' }),
    );
  });

  it('expires previous active subscriptions when granting a new plan', async () => {
    const ctx = setup();
    const previous = Subscription.createAdminGrant({
      id: 'old-sub',
      schoolId,
      planId,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T00:00:00.000Z'),
    });
    ctx.subscriptions.findManyBySchoolId.mockResolvedValue([previous]);

    await ctx.useCase.execute({
      schoolId,
      actorUserId,
      status: SchoolStatus.ACTIVE,
      planId,
      endsAt: '2027-08-11T23:59:59.000Z',
    });

    expect(previous.status).toBe(SubscriptionStatus.EXPIRED);
  });

  it('requires reason when suspending', async () => {
    const { useCase } = setup();
    await expect(
      useCase.execute({
        schoolId,
        actorUserId,
        status: SchoolStatus.SUSPENDED,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleViolationException);
  });

  it('requires planId and period when activating', async () => {
    const { useCase } = setup();
    await expect(
      useCase.execute({
        schoolId,
        actorUserId,
        status: SchoolStatus.ACTIVE,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleViolationException);
  });
});
