import { Injectable } from '@nestjs/common';
import { ConciergeMessageKind, ConciergePhase } from '@prisma/client';
import { UseCase } from '../../../../shared/application/use-case';
import {
  NeedsProfile,
  buildSessionTitle,
  isNeedsReady,
  mergeNeeds,
  type ResultsAnswerTopic,
} from '../../domain/concierge.types';
import {
  answerFromResults,
  detectResultsTopic,
  isOffTopicMessage,
  isResultsFollowUpContext,
  offTopicReply,
} from '../../domain/services/answer-from-results';
import { OllamaConciergeClient } from '../../infrastructure/ollama/ollama-concierge.client';
import { presentMessage } from '../../infrastructure/http/concierge.presenter';
import { toMarketplaceCard } from '../../../marketplace/domain/services/marketplace-card.mapper';
import type { MarketplaceSchoolCard } from '../../../marketplace/domain/marketplace-search.types';
import { PrismaMarketplaceSearchQuery } from '../../../marketplace/infrastructure/persistence/prisma/prisma-marketplace-search.query';
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
    private readonly marketplaceQuery: PrismaMarketplaceSearchQuery,
  ) {}

  async execute(input: ProcessConciergeTurnInput) {
    const session = await this.store.getSessionOrThrow(input.sessionId);
    this.store.assertCanAccess(session, {
      userId: input.userId,
      deviceId: input.deviceId,
    });

    const currentNeeds = session.needs as NeedsProfile;
    const resultIds = Array.isArray(session.resultIds)
      ? (session.resultIds as string[])
      : [];
    const hasResults = resultIds.length > 0;
    const message = input.message.trim();

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

    // ── Q&A sobre resultados já mostrados (prioritário) ──────────────
    if (hasResults && isResultsFollowUpContext(message)) {
      const topic =
        detectResultsTopic(message) ?? ('generic' as ResultsAnswerTopic);
      const schools = await this.loadResultCards(resultIds);
      const reply = answerFromResults(topic, schools, message, session.id);

      const userMessage = await this.store.addMessage({
        sessionId: session.id,
        role: 'user',
        kind: ConciergeMessageKind.text,
        content: message,
      });
      const assistantMessage = await this.store.addMessage({
        sessionId: session.id,
        role: 'assistant',
        kind: ConciergeMessageKind.text,
        content: reply,
      });
      const updated = await this.store.updateNeeds(session.id, currentNeeds, {
        phase: ConciergePhase.results,
        title: session.title,
      });

      return this.presentTurn(updated, userMessage, assistantMessage, {
        shouldSearch: false,
        compareTop: null,
        softAdjust: null,
      });
    }

    // ── Fora do domínio ──────────────────────────────────────────────
    if (isOffTopicMessage(message)) {
      const userMessage = await this.store.addMessage({
        sessionId: session.id,
        role: 'user',
        kind: ConciergeMessageKind.text,
        content: message,
      });
      const assistantMessage = await this.store.addMessage({
        sessionId: session.id,
        role: 'assistant',
        kind: ConciergeMessageKind.text,
        content: offTopicReply(),
      });
      return this.presentTurn(session, userMessage, assistantMessage, {
        shouldSearch: false,
        compareTop: null,
        softAdjust: null,
      });
    }

    const llm = await this.ollama.interpretTurn(
      message,
      currentNeeds,
      history,
      { hasResults, resultIds },
    );

    // Rede de segurança: LLM pediu search mas a mensagem é follow-up
    if (
      hasResults &&
      (llm.intent === 'answer_from_results' ||
        llm.resultsTopic ||
        (llm.actions.shouldSearch && isResultsFollowUpContext(message)))
    ) {
      const topic =
        llm.resultsTopic ??
        detectResultsTopic(message) ??
        ('generic' as ResultsAnswerTopic);
      const schools = await this.loadResultCards(resultIds);
      const reply =
        topic === 'generic' && llm.reply?.trim() && !llm.actions.shouldSearch
          ? llm.reply.trim()
          : answerFromResults(topic, schools, message, session.id);

      const userMessage = await this.store.addMessage({
        sessionId: session.id,
        role: 'user',
        kind: ConciergeMessageKind.text,
        content: message,
      });
      const assistantMessage = await this.store.addMessage({
        sessionId: session.id,
        role: 'assistant',
        kind: ConciergeMessageKind.text,
        content: reply,
      });
      const updated = await this.store.updateNeeds(session.id, currentNeeds, {
        phase: ConciergePhase.results,
        title: session.title,
      });
      return this.presentTurn(updated, userMessage, assistantMessage, {
        shouldSearch: false,
        compareTop: null,
        softAdjust: null,
      });
    }

    if (llm.intent === 'off_topic') {
      const userMessage = await this.store.addMessage({
        sessionId: session.id,
        role: 'user',
        kind: ConciergeMessageKind.text,
        content: message,
      });
      const assistantMessage = await this.store.addMessage({
        sessionId: session.id,
        role: 'assistant',
        kind: ConciergeMessageKind.text,
        content: llm.reply || offTopicReply(),
      });
      return this.presentTurn(session, userMessage, assistantMessage, {
        shouldSearch: false,
        compareTop: null,
        softAdjust: null,
      });
    }

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

    const wasReady = isNeedsReady(currentNeeds);
    const readyNow = isNeedsReady(needs);
    // Não re-pesquisar só porque "gratuita" foi dita em follow-up (já tratado acima)
    const shouldSearch =
      Boolean(llm.actions.shouldSearch) || (readyNow && !wasReady);
    const phase: ConciergePhase = shouldSearch
      ? ConciergePhase.processing
      : hasResults
        ? ConciergePhase.results
        : ConciergePhase.collecting;
    const title = buildSessionTitle(needs);

    const userMessage = await this.store.addMessage({
      sessionId: session.id,
      role: 'user',
      kind: ConciergeMessageKind.text,
      content: message,
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

    return this.presentTurn(updated, userMessage, assistantMessage, {
      shouldSearch,
      compareTop: llm.actions.compareTop,
      softAdjust: llm.actions.softAdjust,
    });
  }

  private async loadResultCards(
    resultIds: string[],
  ): Promise<MarketplaceSchoolCard[]> {
    if (!resultIds.length) return [];
    const rows = await this.marketplaceQuery.findVisibleByIds(resultIds);
    const byId = new Map(rows.map((r) => [r.id, r]));
    const filters = {
      serviceIds: [] as import('../../../school/domain/school.enums').SchoolServiceCatalogId[],
      fullDay: false,
      sort: 'recommended' as const,
      page: 1,
      pageSize: resultIds.length,
    };
    return resultIds
      .map((id) => {
        const row = byId.get(id);
        return row ? toMarketplaceCard(row, filters) : null;
      })
      .filter((c): c is MarketplaceSchoolCard => Boolean(c));
  }

  private presentTurn(
    session: {
      id: string;
      title: string;
      phase: ConciergePhase;
      needs: unknown;
      resultIds: unknown;
      updatedAt: Date;
    },
    userMessage: { id: string; [k: string]: unknown },
    assistantMessage: { id: string; [k: string]: unknown },
    actions: {
      shouldSearch: boolean;
      compareTop: 2 | 3 | null;
      softAdjust: string | null;
    },
  ) {
    return {
      session: {
        id: session.id,
        title: session.title,
        phase: session.phase,
        needs: session.needs,
        resultIds: session.resultIds,
        updatedAt: session.updatedAt.toISOString(),
      },
      userMessage: presentMessage(userMessage as never),
      assistantMessages: [presentMessage(assistantMessage as never)],
      actions,
    };
  }
}
