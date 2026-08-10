import { Module, forwardRef } from '@nestjs/common';
import { SchoolModule } from '../school/school.module';
import { ActivateSchoolFreePlanUseCase } from './application/use-cases/activate-school-free-plan.use-case';
import { CancelPaymentUseCase } from './application/use-cases/cancel-payment.use-case';
import { ConfirmPaymentUseCase } from './application/use-cases/confirm-payment.use-case';
import { CreateSubscriptionUseCase } from './application/use-cases/create-subscription.use-case';
import { ExpireSubscriptionUseCase } from './application/use-cases/expire-subscription.use-case';
import { FailPaymentUseCase } from './application/use-cases/fail-payment.use-case';
import { ProcessPaymentUseCase } from './application/use-cases/process-payment.use-case';
import { RenewSubscriptionUseCase } from './application/use-cases/renew-subscription.use-case';
import { ActivateSubscriptionUseCase } from './application/use-cases/activate-subscription.use-case';
import { StartPaymentUseCase } from './application/use-cases/start-payment.use-case';
import { SchoolEntitlementService } from './application/services/school-entitlement.service';
import {
  PLAN_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
} from './domain/repositories/billing.repositories';
import { PrismaPlanRepository } from './infrastructure/persistence/prisma/prisma-plan.repository';
import { PrismaSubscriptionRepository } from './infrastructure/persistence/prisma/prisma-subscription.repository';
import { BillingController } from './infrastructure/http/controllers/billing.controller';
import { SubscriptionsController } from './infrastructure/http/controllers/subscriptions.controller';
import { PaymentsController } from './infrastructure/http/controllers/payments.controller';

@Module({
  imports: [forwardRef(() => SchoolModule)],
  controllers: [BillingController, SubscriptionsController, PaymentsController],
  providers: [
    { provide: PLAN_REPOSITORY, useClass: PrismaPlanRepository },
    {
      provide: SUBSCRIPTION_REPOSITORY,
      useClass: PrismaSubscriptionRepository,
    },
    ActivateSchoolFreePlanUseCase,
    SchoolEntitlementService,
    CreateSubscriptionUseCase,
    StartPaymentUseCase,
    ProcessPaymentUseCase,
    ConfirmPaymentUseCase,
    FailPaymentUseCase,
    CancelPaymentUseCase,
    ActivateSubscriptionUseCase,
    ExpireSubscriptionUseCase,
    RenewSubscriptionUseCase,
  ],
  exports: [
    PLAN_REPOSITORY,
    SUBSCRIPTION_REPOSITORY,
    ActivateSchoolFreePlanUseCase,
    SchoolEntitlementService,
  ],
})
export class BillingModule {}
