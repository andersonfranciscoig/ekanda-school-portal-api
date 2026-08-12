import { Module, forwardRef } from '@nestjs/common';
import { SchoolModule } from '../school/school.module';
import { IdentityModule } from '../identity/identity.module';
import { SchoolEntitlementService } from './application/services/school-entitlement.service';
import { ConfirmSubscriptionPaymentService } from './application/services/confirm-subscription-payment.service';
import { WalletLedgerService } from './application/services/wallet-ledger.service';
import { ActivateSchoolFreePlanUseCase } from './application/use-cases/activate-school-free-plan.use-case';
import { ActivateSubscriptionUseCase } from './application/use-cases/activate-subscription.use-case';
import { CancelPaymentUseCase } from './application/use-cases/cancel-payment.use-case';
import { CancelSubscriptionUseCase } from './application/use-cases/cancel-subscription.use-case';
import { ConfirmPaymentUseCase } from './application/use-cases/confirm-payment.use-case';
import { CreateSubscriptionUseCase } from './application/use-cases/create-subscription.use-case';
import { ExpireSubscriptionUseCase } from './application/use-cases/expire-subscription.use-case';
import { FailPaymentUseCase } from './application/use-cases/fail-payment.use-case';
import { GetCurrentSubscriptionUseCase } from './application/use-cases/get-current-subscription.use-case';
import { GetPaymentUseCase } from './application/use-cases/get-payment.use-case';
import { GetPlanUseCase } from './application/use-cases/get-plan.use-case';
import { GetSchoolWalletUseCase } from './application/use-cases/get-school-wallet.use-case';
import { ListPlansUseCase } from './application/use-cases/list-plans.use-case';
import { ListSchoolPaymentsUseCase } from './application/use-cases/list-school-payments.use-case';
import { ListSchoolSubscriptionsUseCase } from './application/use-cases/list-school-subscriptions.use-case';
import { ListWalletTransactionsUseCase } from './application/use-cases/list-wallet-transactions.use-case';
import { ProcessPaymentUseCase } from './application/use-cases/process-payment.use-case';
import { ProcessFindoraWebhookUseCase } from './application/use-cases/process-findora-webhook.use-case';
import { InitiatePaymentCheckoutUseCase } from './application/use-cases/initiate-payment-checkout.use-case';
import { RenewSubscriptionUseCase } from './application/use-cases/renew-subscription.use-case';
import { StartPaymentUseCase } from './application/use-cases/start-payment.use-case';
import { UpgradeSubscriptionUseCase } from './application/use-cases/upgrade-subscription.use-case';
import {
  PAYMENT_REPOSITORY,
  PLAN_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
} from './domain/repositories/billing.repositories';
import { BillingController } from './infrastructure/http/controllers/billing.controller';
import { PaymentsController } from './infrastructure/http/controllers/payments.controller';
import { SubscriptionsController } from './infrastructure/http/controllers/subscriptions.controller';
import { WalletController } from './infrastructure/http/controllers/wallet.controller';
import { FeatureGuard } from './infrastructure/http/guards/feature.guard';
import { ExpireSubscriptionsJob } from './infrastructure/jobs/expire-subscriptions.job';
import { PrismaPaymentRepository } from './infrastructure/persistence/prisma/prisma-payment.repository';
import { PrismaPlanRepository } from './infrastructure/persistence/prisma/prisma-plan.repository';
import { PrismaSubscriptionRepository } from './infrastructure/persistence/prisma/prisma-subscription.repository';
import { paymentGatewayProvider } from './infrastructure/gateway/payment-gateway.provider';

@Module({
  imports: [forwardRef(() => SchoolModule), IdentityModule],
  controllers: [
    BillingController,
    SubscriptionsController,
    PaymentsController,
    WalletController,
  ],
  providers: [
    { provide: PLAN_REPOSITORY, useClass: PrismaPlanRepository },
    {
      provide: SUBSCRIPTION_REPOSITORY,
      useClass: PrismaSubscriptionRepository,
    },
    { provide: PAYMENT_REPOSITORY, useClass: PrismaPaymentRepository },
    paymentGatewayProvider,
    WalletLedgerService,
    ConfirmSubscriptionPaymentService,
    SchoolEntitlementService,
    FeatureGuard,
    ExpireSubscriptionsJob,
    ActivateSchoolFreePlanUseCase,
    ListPlansUseCase,
    GetPlanUseCase,
    CreateSubscriptionUseCase,
    GetCurrentSubscriptionUseCase,
    ListSchoolSubscriptionsUseCase,
    StartPaymentUseCase,
    InitiatePaymentCheckoutUseCase,
    ProcessPaymentUseCase,
    ProcessFindoraWebhookUseCase,
    ConfirmPaymentUseCase,
    FailPaymentUseCase,
    CancelPaymentUseCase,
    ActivateSubscriptionUseCase,
    ExpireSubscriptionUseCase,
    RenewSubscriptionUseCase,
    CancelSubscriptionUseCase,
    UpgradeSubscriptionUseCase,
    GetSchoolWalletUseCase,
    ListWalletTransactionsUseCase,
    ListSchoolPaymentsUseCase,
    GetPaymentUseCase,
  ],
  exports: [
    PLAN_REPOSITORY,
    SUBSCRIPTION_REPOSITORY,
    PAYMENT_REPOSITORY,
    ActivateSchoolFreePlanUseCase,
    SchoolEntitlementService,
    FeatureGuard,
    WalletLedgerService,
  ],
})
export class BillingModule {}
