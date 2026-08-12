import { ConfigService } from '@nestjs/config';
import { PAYMENT_GATEWAY } from '../../application/ports/payment-gateway.port';
import { FindoraPaymentGateway } from './findora-payment.gateway';
import { SimulatedPaymentGateway } from './simulated-payment.gateway';

export const paymentGatewayProvider = {
  provide: PAYMENT_GATEWAY,
  useFactory: (config: ConfigService) => {
    const provider = config.get<string>('PAYMENT_GATEWAY', 'simulated');
    if (provider === 'findora' || provider === 'findora_test') {
      return new FindoraPaymentGateway(config, {
        testMode: provider === 'findora_test',
      });
    }
    return new SimulatedPaymentGateway();
  },
  inject: [ConfigService],
};
