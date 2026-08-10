import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ConciergeSessionStore } from '../services/concierge-session.store';
import { presentSession } from '../../infrastructure/http/concierge.presenter';

export type GetConciergeSessionInput = {
  sessionId: string;
  userId?: string | null;
  deviceId?: string | null;
};

@Injectable()
export class GetConciergeSessionUseCase
  implements UseCase<GetConciergeSessionInput, ReturnType<typeof presentSession>>
{
  constructor(private readonly store: ConciergeSessionStore) {}

  async execute(input: GetConciergeSessionInput) {
    const session = await this.store.getSessionOrThrow(input.sessionId);
    this.store.assertCanAccess(session, {
      userId: input.userId,
      deviceId: input.deviceId,
    });
    return presentSession(session);
  }
}
