import { SubscriptionStatus } from '@prisma/client';
import { ViewSubscriptionsUseCase } from './view-subscriptions.use-case';

describe('ViewSubscriptionsUseCase', () => {
  it('filters EXPIRING_SOON as ACTIVE ending within 14 days', async () => {
    const prisma = {
      subscription: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const useCase = new ViewSubscriptionsUseCase(prisma as never);
    await useCase.execute({ status: 'EXPIRING_SOON' });
    const where = prisma.subscription.findMany.mock.calls[0][0].where;
    expect(where.status).toBe(SubscriptionStatus.ACTIVE);
    expect(where.endDate.gt).toBeInstanceOf(Date);
    expect(where.endDate.lte).toBeInstanceOf(Date);
  });
});
