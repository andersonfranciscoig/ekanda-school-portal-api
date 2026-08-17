import { Module, forwardRef } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { MailModule } from '../mail/mail.module';
import { SchoolModule } from '../school/school.module';
import { EnforceNifDeadlineUseCase } from './application/enforce-nif-deadline.use-case';
import { SchoolLegalService } from './application/school-legal.service';
import { NifDeadlineCron } from './infrastructure/cron/nif-deadline.cron';
import { SchoolLegalAdminController } from './infrastructure/http/controllers/school-legal-admin.controller';
import { SchoolLegalController } from './infrastructure/http/controllers/school-legal.controller';

@Module({
  imports: [SchoolModule, MailModule, forwardRef(() => BillingModule)],
  controllers: [SchoolLegalController, SchoolLegalAdminController],
  providers: [SchoolLegalService, EnforceNifDeadlineUseCase, NifDeadlineCron],
  exports: [SchoolLegalService, EnforceNifDeadlineUseCase],
})
export class SchoolLegalModule {}
