import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { ConciergeSessionStore } from './application/services/concierge-session.store';
import { CreateConciergeSessionUseCase } from './application/use-cases/create-concierge-session.use-case';
import { GetConciergeSessionUseCase } from './application/use-cases/get-concierge-session.use-case';
import { ListConciergeSessionsUseCase } from './application/use-cases/list-concierge-sessions.use-case';
import { PatchConciergeNeedsUseCase } from './application/use-cases/patch-concierge-needs.use-case';
import { ProcessConciergeTurnUseCase } from './application/use-cases/process-concierge-turn.use-case';
import { SearchConciergeSessionUseCase } from './application/use-cases/search-concierge-session.use-case';
import {
  GetConciergeVisitByCodeUseCase,
  ScheduleConciergeVisitUseCase,
} from './application/use-cases/schedule-concierge-visit.use-case';
import { ConciergeController } from './infrastructure/http/controllers/concierge.controller';
import { OllamaConciergeClient } from './infrastructure/ollama/ollama-concierge.client';

@Module({
  imports: [IdentityModule, MarketplaceModule],
  controllers: [ConciergeController],
  providers: [
    ConciergeSessionStore,
    OllamaConciergeClient,
    CreateConciergeSessionUseCase,
    ListConciergeSessionsUseCase,
    GetConciergeSessionUseCase,
    ProcessConciergeTurnUseCase,
    SearchConciergeSessionUseCase,
    PatchConciergeNeedsUseCase,
    ScheduleConciergeVisitUseCase,
    GetConciergeVisitByCodeUseCase,
  ],
})
export class ConciergeModule {}
