import { Money } from '../../../../shared/domain/value-objects/money.vo';
import { Payment, PaymentStatus } from './payment.aggregate';

describe('Payment aggregate', () => {
  function makePending() {
    return Payment.create({
      id: 'pay-1',
      schoolId: 'school-1',
      amount: Money.create(10000, 'Kz'),
      method: 'MULTICAIXA_EXPRESS',
      expressPhone: '923000000',
    });
  }

  it('starts PENDING and confirms from gateway evidence', () => {
    const payment = makePending();
    expect(payment.status).toBe(PaymentStatus.PENDING);
    payment.confirmFromGateway({ externalTransactionId: 'EXP-1' });
    expect(payment.status).toBe(PaymentStatus.PAID);
    expect(payment.isPaid()).toBe(true);
  });

  it('is idempotent when confirming the same gateway id twice', () => {
    const payment = makePending();
    payment.confirmFromGateway({ externalTransactionId: 'EXP-1' });
    payment.confirmFromGateway({ externalTransactionId: 'EXP-1' });
    expect(payment.status).toBe(PaymentStatus.PAID);
  });

  it('does not activate from frontend without gateway id', () => {
    const payment = makePending();
    expect(() =>
      payment.confirmFromGateway({ externalTransactionId: '  ' }),
    ).toThrow();
    expect(payment.status).toBe(PaymentStatus.PENDING);
  });
});
