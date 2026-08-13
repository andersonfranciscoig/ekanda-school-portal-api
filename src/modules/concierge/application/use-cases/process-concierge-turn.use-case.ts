import { Injectable } from '@nestjs/common';
import { ConciergeMessageKind, ConciergePhase } from '@prisma/client';
import { UseCase } from '../../../../shared/application/use-case';
import {
  NeedsProfile,
  buildSessionTitle,
  isNeedsReady,
  mergeNeeds,
} from '../../domain/concierge.types';
import { OllamaConciergeClient } from '../../infrastructure/ollama/ollama-concierge.client';
import { presentMessage } from '../../infrastructure/http/concierge.presenter';
import { ConciergeSessionStore } from '../services/concierge-session.store';

export type ProcessConciergeTurnInput = {
  sessionId: string;
  message: string;
  userId?: string | null;
  deviceId?: string | null;
};

@Injectable()
export class ProcessConciergeTurnUseCase
  implements UseCase<ProcessConciergeTurnInput, unknown>
{
  constructor(
    private readonly store: ConciergeSessionStore,
    private readonly ollama: OllamaConciergeClient,
  ) {}

  async execute(input: ProcessConciergeTurnInput) {
    const session = await this.store.getSessionOrThrow(input.sessionId);
    this.store.assertCanAccess(session, {
      userId: input.userId,
      deviceId: input.deviceId,
    });

    const currentNeeds = session.needs as NeedsProfile;
    const history = (session.messages ?? [])
      .filter(
        (m) =>
          (m.role === 'user' || m.role === 'assistant') &&
          m.kind === ConciergeMessageKind.text &&
          Boolean(m.content?.trim()),
      )
      .slice(-10)
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const llm = await this.ollama.interpretTurn(
      input.message,
      currentNeeds,
      history,
    );
    const needs = mergeNeeds(currentNeeds, llm.needsPatch);

    if (llm.actions.softAdjust === 'cheaper' && needs.precoMax != null) {
      needs.precoMax = Math.round(needs.precoMax * 0.85);
    }
    if (llm.actions.softAdjust === 'only_transport') {
      needs.transporte = true;
    }
    if (llm.actions.softAdjust === 'no_transport') {
      needs.transporte = false;
    }

    const shouldSearch = llm.actions.shouldSearch || isNeedsReady(needs);
    const phase: ConciergePhase = shouldSearch
      ? ConciergePhase.processing
      : ConciergePhase.collecting;
    const title = buildSessionTitle(needs);

    const userMessage = await this.store.addMessage({
      sessionId: session.id,
      role: 'user',
      kind: ConciergeMessageKind.text,
      content: input.message.trim(),
    });

    const assistantMessage = await this.store.addMessage({
      sessionId: session.id,
      role: 'assistant',
      kind: ConciergeMessageKind.text,
      content: llm.reply,
    });

    const updated = await this.store.updateNeeds(session.id, needs, {
      phase,
      title,
    });

    return {
      session: {
        id: updated.id,
        title: updated.title,
        phase: updated.phase,
        needs: updated.needs,
        resultIds: updated.resultIds,
        updatedAt: updated.updatedAt.toISOString(),
      },
      userMessage: presentMessage(userMessage),
      assistantMessages: [presentMessage(assistantMessage)],
      actions: {
        shouldSearch,
        compareTop: llm.actions.compareTop,
        softAdjust: llm.actions.softAdjust,
      },
    };
  }
}
