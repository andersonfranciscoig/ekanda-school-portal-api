import {
  Subscription,
  SubscriptionStatus,
} from './subscription.aggregate';

describe('Subscription aggregate', () => {
  it('creates a pending paid subscription that only activates with payment', () => {
    const sub = Subscription.createPending({
      id: 'sub-1',
      schoolId: 'school-1',
      planId: 'plan-1',
    });
    expect(sub.status).toBe(SubscriptionStatus.PENDING);
    expect(() =>
      sub.activate({
        planIsActive: true,
        hasValidPayment: false,
        startDate: new Date(),
      }),
    ).toThrow();
    sub.activate({
      planIsActive: true,
      hasValidPayment: true,
      startDate: new Date('2026-08-11T00:00:00.000Z'),
      endDate: new Date('2026-09-11T00:00:00.000Z'),
    });
    expect(sub.status).toBe(SubscriptionStatus.ACTIVE);
    expect(sub.isValidNow(new Date('2026-08-15T00:00:00.000Z'))).toBe(true);
  });

  it('cancels only at period end and expires when the date passes', () => {
    const sub = Subscription.createPending({
      id: 'sub-2',
      schoolId: 'school-1',
      planId: 'plan-1',
    });
    sub.activate({
      planIsActive: true,
      hasValidPayment: true,
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      endDate: new Date('2026-08-01T00:00:00.000Z'),
    });
    sub.scheduleCancelAtPeriodEnd(new Date('2026-07-15T00:00:00.000Z'));
    expect(sub.cancelAtPeriodEnd).toBe(true);
    expect(sub.status).toBe(SubscriptionStatus.ACTIVE);

    const changed = sub.syncExpiration(new Date('2026-08-01T00:00:00.000Z'));
    expect(changed).toBe(true);
    expect(sub.status).toBe(SubscriptionStatus.EXPIRED);
  });

  it('renews without losing remaining paid days', () => {
    const sub = Subscription.createPending({
      id: 'sub-3',
      schoolId: 'school-1',
      planId: 'plan-1',
    });
    sub.activate({
      planIsActive: true,
      hasValidPayment: true,
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      endDate: new Date('2026-09-01T00:00:00.000Z'),
    });
    sub.renew({
      hasValidPayment: true,
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      endDate: new Date('2026-10-01T00:00:00.000Z'),
    });
    expect(sub.endDate?.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(sub.status).toBe(SubscriptionStatus.ACTIVE);
  });
});
