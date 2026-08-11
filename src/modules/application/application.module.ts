import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { BillingModule } from '../billing/billing.module';
import { ApplicationsController } from './infrastructure/http/controllers/applications.controller';
import { StudentsController } from './infrastructure/http/controllers/students.controller';
import * as UseCases from './application/use-cases';

@Module({
  imports: [IdentityModule, BillingModule],
  controllers: [ApplicationsController, StudentsController],
  providers: [...Object.values(UseCases)],
})
export class ApplicationModule {}
