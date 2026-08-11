import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ExpireSubscriptionUseCase } from '../../application/use-cases/expire-subscription.use-case';

@Injectable()
export class ExpireSubscriptionsJob {
  private readonly logger = new Logger(ExpireSubscriptionsJob.name);

  constructor(private readonly expireDue: ExpireSubscriptionUseCase) {}

  @Cron('5 * * * *')
  async handle() {
    const result = await this.expireDue.execute({ now: new Date() });
    if (result.expired > 0) {
      this.logger.log(`Expired ${result.expired} subscription(s)`);
    }
  }
}
