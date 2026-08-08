import { Module } from '@nestjs/common';
import { AdminController } from './infrastructure/http/controllers/admin.controller';
import { AuditController } from './infrastructure/http/controllers/audit.controller';
import * as UseCases from './application/use-cases';

@Module({
  controllers: [AdminController, AuditController],
  providers: [...Object.values(UseCases)],
})
export class AdministrationModule {}
