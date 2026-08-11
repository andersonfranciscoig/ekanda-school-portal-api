import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ConciergeSessionStore } from '../services/concierge-session.store';

export type DeleteConciergeSessionInput = {
  sessionId: string;
  userId?: string | null;
  deviceId?: string | null;
};

export type DeleteAllConciergeSessionsInput = {
  userId?: string | null;
  deviceId?: string | null;
};

@Injectable()
export class DeleteConciergeSessionUseCase
  implements UseCase<DeleteConciergeSessionInput, { id: string }>
{
  constructor(private readonly store: ConciergeSessionStore) {}

  execute(input: DeleteConciergeSessionInput) {
    return this.store.deleteSession(input.sessionId, {
      userId: input.userId,
      deviceId: input.deviceId,
    });
  }
}

@Injectable()
export class DeleteAllConciergeSessionsUseCase
  implements UseCase<DeleteAllConciergeSessionsInput, { deletedCount: number }>
{
  constructor(private readonly store: ConciergeSessionStore) {}

  execute(input: DeleteAllConciergeSessionsInput) {
    return this.store.deleteAllSessions({
      userId: input.userId,
      deviceId: input.deviceId,
    });
  }
}
