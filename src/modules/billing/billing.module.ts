import { Module } from '@nestjs/common';
import { BillingController } from './infrastructure/http/controllers/billing.controller';
import { SubscriptionsController } from './infrastructure/http/controllers/subscriptions.controller';
import { PaymentsController } from './infrastructure/http/controllers/payments.controller';
import * as UseCases from './application/use-cases';

@Module({
  controllers: [BillingController, SubscriptionsController, PaymentsController],
  providers: [...Object.values(UseCases)],
})
export class BillingModule {}
