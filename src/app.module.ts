import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SharedInfrastructureModule } from './shared/infrastructure/persistence/prisma/shared-infrastructure.module';
import { IdentityModule } from './modules/identity/identity.module';
import { SchoolModule } from './modules/school/school.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { ConciergeModule } from './modules/concierge/concierge.module';
import { ApplicationModule } from './modules/application/application.module';
import { BillingModule } from './modules/billing/billing.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AdministrationModule } from './modules/administration/administration.module';
import { GestaoRolloutModule } from './modules/gestao-rollout/gestao-rollout.module';
import { SchoolLegalModule } from './modules/school-legal/school-legal.module';
import { PlatformBetaModule } from './modules/platform-beta/platform-beta.module';
import { MailModule } from './modules/mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    ScheduleModule.forRoot(),
    SharedInfrastructureModule,
    NotificationModule,
    IdentityModule,
    SchoolModule,
    MarketplaceModule,
    ConciergeModule,
    ApplicationModule,
    BillingModule,
    GestaoRolloutModule,
    SchoolLegalModule,
    PlatformBetaModule,
    MailModule,
    AdministrationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
