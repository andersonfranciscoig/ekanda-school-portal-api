import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { SchoolModule } from '../school/school.module';
import { GestaoRolloutService } from './application/gestao-rollout.service';
import { GestaoAdminController } from './infrastructure/http/controllers/gestao-admin.controller';
import { GestaoSchoolController } from './infrastructure/http/controllers/gestao-school.controller';

@Module({
  imports: [SchoolModule, MailModule],
  controllers: [GestaoAdminController, GestaoSchoolController],
  providers: [GestaoRolloutService],
  exports: [GestaoRolloutService],
})
export class GestaoRolloutModule {}
