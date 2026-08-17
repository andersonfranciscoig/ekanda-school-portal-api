import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EnforceNifDeadlineUseCase } from '../../application/enforce-nif-deadline.use-case';

@Injectable()
export class NifDeadlineCron {
  constructor(private readonly enforce: EnforceNifDeadlineUseCase) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async handleNifDeadline() {
    await this.enforce.execute();
  }
}
