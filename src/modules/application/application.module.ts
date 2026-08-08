import { Module } from '@nestjs/common';
import { ApplicationsController } from './infrastructure/http/controllers/applications.controller';
import { StudentsController } from './infrastructure/http/controllers/students.controller';
import * as UseCases from './application/use-cases';

@Module({
  controllers: [ApplicationsController, StudentsController],
  providers: [...Object.values(UseCases)],
})
export class ApplicationModule {}
