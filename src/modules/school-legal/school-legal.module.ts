import { Module, forwardRef } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { MailModule } from '../mail/mail.module';
import { PlatformBetaModule } from '../platform-beta/platform-beta.module';
import { SchoolModule } from '../school/school.module';
import { EnforceNifDeadlineUseCase } from './application/enforce-nif-deadline.use-case';
import { NIF_LOOKUP_PORT } from './application/ports/nif-lookup.port';
import { SchoolLegalService } from './application/school-legal.service';
import { HttpAgtNifLookupAdapter } from './infrastructure/agt/http-agt-nif-lookup.adapter';
import { NifDeadlineCron } from './infrastructure/cron/nif-deadline.cron';
import { SchoolLegalAdminController } from './infrastructure/http/controllers/school-legal-admin.controller';
import { SchoolLegalController } from './infrastructure/http/controllers/school-legal.controller';

@Module({
  imports: [
    SchoolModule,
    MailModule,
    PlatformBetaModule,
    forwardRef(() => BillingModule),
  ],
  controllers: [SchoolLegalController, SchoolLegalAdminController],
  providers: [
    SchoolLegalService,
    EnforceNifDeadlineUseCase,
    NifDeadlineCron,
    HttpAgtNifLookupAdapter,
    { provide: NIF_LOOKUP_PORT, useExisting: HttpAgtNifLookupAdapter },
  ],
  exports: [SchoolLegalService, EnforceNifDeadlineUseCase],
})
export class SchoolLegalModule {}
