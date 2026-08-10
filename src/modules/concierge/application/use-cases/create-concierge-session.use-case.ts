import { Injectable } from '@nestjs/common';
import { ConciergePhase } from '@prisma/client';
import { UseCase } from '../../../../shared/application/use-case';
import { ConciergeSessionStore } from '../services/concierge-session.store';
import { presentSession } from '../../infrastructure/http/concierge.presenter';

export type CreateConciergeSessionInput = {
  userId?: string | null;
  deviceId?: string | null;
};

@Injectable()
export class CreateConciergeSessionUseCase
  implements UseCase<CreateConciergeSessionInput, ReturnType<typeof presentSession>>
{
  constructor(private readonly store: ConciergeSessionStore) {}

  async execute(input: CreateConciergeSessionInput) {
    const session = await this.store.createSession({
      userId: input.userId,
      deviceId: input.deviceId,
    });
    // phase greeting conceptually, but contract starts collecting after welcome
    if (session.phase !== ConciergePhase.collecting) {
      // no-op
    }
    return presentSession(session);
  }
}
