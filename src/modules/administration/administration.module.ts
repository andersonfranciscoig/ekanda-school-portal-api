import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { SchoolModule } from '../school/school.module';
import { AdminController } from './infrastructure/http/controllers/admin.controller';
import { AuditController } from './infrastructure/http/controllers/audit.controller';
import * as UseCases from './application/use-cases';

@Module({
  imports: [IdentityModule, SchoolModule],
  controllers: [AdminController, AuditController],
  providers: [...Object.values(UseCases)],
})
export class AdministrationModule {}
