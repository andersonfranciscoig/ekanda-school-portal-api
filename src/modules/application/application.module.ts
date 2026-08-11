import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { BillingModule } from '../billing/billing.module';
import { SchoolModule } from '../school/school.module';
import { ApplicationsController } from './infrastructure/http/controllers/applications.controller';
import { SchoolApplicationsController } from './infrastructure/http/controllers/school-applications.controller';
import { StudentsController } from './infrastructure/http/controllers/students.controller';
import * as UseCases from './application/use-cases';

@Module({
  imports: [IdentityModule, BillingModule, SchoolModule],
  controllers: [
    ApplicationsController,
    SchoolApplicationsController,
    StudentsController,
  ],
  providers: [...Object.values(UseCases)],
  exports: [...Object.values(UseCases)],
})
export class ApplicationModule {}
