import { Module } from '@nestjs/common';
import { MarketplaceController } from './infrastructure/http/controllers/marketplace.controller';
import * as UseCases from './application/use-cases';

@Module({
  controllers: [MarketplaceController],
  providers: [...Object.values(UseCases)],
})
export class MarketplaceModule {}
