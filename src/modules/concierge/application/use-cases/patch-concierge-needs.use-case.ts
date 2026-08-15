import { Injectable } from '@nestjs/common';
import { ConciergePhase } from '@prisma/client';
import { UseCase } from '../../../../shared/application/use-case';
import {
  NeedsProfile,
  buildSessionTitle,
  isNeedsReady,
  mergeNeeds,
} from '../../domain/concierge.types';
import { presentSession } from '../../infrastructure/http/concierge.presenter';
import { ConciergeSessionStore } from '../services/concierge-session.store';
import { SearchConciergeSessionUseCase } from './search-concierge-session.use-case';

export type PatchConciergeNeedsInput = {
  sessionId: string;
  userId?: string | null;
  deviceId?: string | null;
  needs: Partial<NeedsProfile>;
  runSearch?: boolean;
  lat?: number;
  lng?: number;
};

@Injectable()
export class PatchConciergeNeedsUseCase
  implements UseCase<PatchConciergeNeedsInput, unknown>
{
  constructor(
    private readonly store: ConciergeSessionStore,
    private readonly search: SearchConciergeSessionUseCase,
  ) {}

  async execute(input: PatchConciergeNeedsInput) {
    const session = await this.store.getSessionOrThrow(input.sessionId);
    this.store.assertCanAccess(session, {
      userId: input.userId,
      deviceId: input.deviceId,
    });

    const needs = mergeNeeds(session.needs as NeedsProfile, input.needs);
    const phase = isNeedsReady(needs)
      ? ConciergePhase.processing
      : ConciergePhase.adjusting;

    const updated = await this.store.updateNeeds(session.id, needs, {
      phase,
      title: buildSessionTitle(needs),
    });

    if (!input.runSearch) {
      return { session: presentSession(updated) };
    }

    const search = await this.search.execute({
      sessionId: input.sessionId,
      userId: input.userId,
      deviceId: input.deviceId,
      lat: input.lat,
      lng: input.lng,
    });

    return {
      session: presentSession(
        await this.store.getSessionOrThrow(input.sessionId),
      ),
      search,
    };
  }
}
