import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { SchoolModule } from '../school/school.module';
import { AiModule } from '../ai/ai.module';
import { ConciergeSessionStore } from './application/services/concierge-session.store';
import { CreateConciergeSessionUseCase } from './application/use-cases/create-concierge-session.use-case';
import {
  DeleteAllConciergeSessionsUseCase,
  DeleteConciergeSessionUseCase,
} from './application/use-cases/delete-concierge-session.use-case';
import { GetConciergeSessionUseCase } from './application/use-cases/get-concierge-session.use-case';
import { ListConciergeSessionsUseCase } from './application/use-cases/list-concierge-sessions.use-case';
import {
  DecideConciergeVisitUseCase,
  ListMyConciergeVisitsUseCase,
  ListSchoolConciergeVisitsUseCase,
} from './application/use-cases/manage-concierge-visits.use-case';
import { PatchConciergeNeedsUseCase } from './application/use-cases/patch-concierge-needs.use-case';
import { ProcessConciergeTurnUseCase } from './application/use-cases/process-concierge-turn.use-case';
import { SearchConciergeSessionUseCase } from './application/use-cases/search-concierge-session.use-case';
import {
  GetConciergeVisitByCodeUseCase,
  ScheduleConciergeVisitUseCase,
} from './application/use-cases/schedule-concierge-visit.use-case';
import { ConciergeController } from './infrastructure/http/controllers/concierge.controller';

@Module({
  imports: [IdentityModule, MarketplaceModule, SchoolModule, AiModule],
  controllers: [ConciergeController],
  providers: [
    ConciergeSessionStore,
    CreateConciergeSessionUseCase,
    ListConciergeSessionsUseCase,
    GetConciergeSessionUseCase,
    DeleteConciergeSessionUseCase,
    DeleteAllConciergeSessionsUseCase,
    ProcessConciergeTurnUseCase,
    SearchConciergeSessionUseCase,
    PatchConciergeNeedsUseCase,
    ScheduleConciergeVisitUseCase,
    GetConciergeVisitByCodeUseCase,
    ListSchoolConciergeVisitsUseCase,
    ListMyConciergeVisitsUseCase,
    DecideConciergeVisitUseCase,
  ],
})
export class ConciergeModule {}
