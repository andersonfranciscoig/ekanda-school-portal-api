import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SharedInfrastructureModule } from './shared/infrastructure/persistence/prisma/shared-infrastructure.module';
import { IdentityModule } from './modules/identity/identity.module';
import { SchoolModule } from './modules/school/school.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { ApplicationModule } from './modules/application/application.module';
import { BillingModule } from './modules/billing/billing.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AdministrationModule } from './modules/administration/administration.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    SharedInfrastructureModule,
    IdentityModule,
    SchoolModule,
    MarketplaceModule,
    ApplicationModule,
    BillingModule,
    NotificationModule,
    AdministrationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
