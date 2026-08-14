import { Injectable } from '@nestjs/common';
import { ConciergeMessageKind, ConciergePhase } from '@prisma/client';
import { UseCase } from '../../../../shared/application/use-case';
import { SearchSchoolsUseCase } from '../../../marketplace/application/use-cases/search-schools.use-case';
import { MarketplaceSchoolCard } from '../../../marketplace/domain/marketplace-search.types';
import {
  NeedsProfile,
  buildSessionTitle,
  needsToMarketplaceFilters,
} from '../../domain/concierge.types';
import { presentMessage } from '../../infrastructure/http/concierge.presenter';
import { OllamaConciergeClient } from '../../infrastructure/ollama/ollama-concierge.client';
import { ConciergeSessionStore } from '../services/concierge-session.store';

export type SearchConciergeSessionInput = {
  sessionId: string;
  userId?: string | null;
  deviceId?: string | null;
  limit?: number;
  relaxIfEmpty?: boolean;
};

type Match = {
  school: MarketplaceSchoolCard;
  score: number;
  motivos: string[];
  /** Explicação em linguagem natural (IA grounded nos factos reais). */
  explicacao: string | null;
};

@Injectable()
export class SearchConciergeSessionUseCase
  implements UseCase<SearchConciergeSessionInput, unknown>
{
  constructor(
    private readonly store: ConciergeSessionStore,
    private readonly marketplaceSearch: SearchSchoolsUseCase,
    private readonly ollama: OllamaConciergeClient,
  ) {}

  async execute(input: SearchConciergeSessionInput) {
    const session = await this.store.getSessionOrThrow(input.sessionId);
    this.store.assertCanAccess(session, {
      userId: input.userId,
      deviceId: input.deviceId,
    });

    const needs = session.needs as NeedsProfile;
    const limit = Math.min(10, Math.max(1, Number(input.limit ?? 5) || 5));
    const relaxIfEmpty = input.relaxIfEmpty !== false;

    let relaxed = false;
    let matches = await this.runSearch(needs, limit);
    let totalAnalisados = matches.totalAnalisados;

    if (matches.items.length === 0 && relaxIfEmpty) {
      relaxed = true;
      // 1) sem serviços/tipo + orçamento ×1.25
      let relaxedNeeds: NeedsProfile = {
        ...needs,
        transporte: null,
        cantina: null,
        ingles: null,
        informatica: null,
        integral: null,
        tipoEnsino: '',
        precoMax:
          needs.precoMax != null ? Math.round(needs.precoMax * 1.25) : null,
      };
      matches = await this.runSearch(relaxedNeeds, limit);
      totalAnalisados = Math.max(totalAnalisados, matches.totalAnalisados);

      // 2) alargar localização: só província (ex.: Talatona → Luanda)
      if (matches.items.length === 0 && needs.provincia?.trim()) {
        relaxedNeeds = {
          ...relaxedNeeds,
          municipio: '',
        };
        matches = await this.runSearch(relaxedNeeds, limit);
        totalAnalisados = Math.max(totalAnalisados, matches.totalAnalisados);
      }

      // 3) sem filtro de classe
      if (matches.items.length === 0) {
        relaxedNeeds = {
          ...relaxedNeeds,
          classe: '',
        };
        matches = await this.runSearch(relaxedNeeds, limit);
        totalAnalisados = Math.max(totalAnalisados, matches.totalAnalisados);
      }
    }

    const enriched = await this.enrichWithAiExplanations(needs, matches.items);
    const resultIds = enriched.items.map((m) => m.school.id);
    const title = buildSessionTitle(needs);

    const assistantMessages = [];

    if (enriched.items.length === 0) {
      assistantMessages.push(
        await this.store.addMessage({
          sessionId: session.id,
          role: 'assistant',
          kind: ConciergeMessageKind.empty,
          content:
            'Não encontrámos instituições com estes critérios. Pode flexibilizar o orçamento, o município ou os serviços?',
        }),
      );
    } else {
      assistantMessages.push(
        await this.store.addMessage({
          sessionId: session.id,
          role: 'assistant',
          kind: ConciergeMessageKind.text,
          content: `Analisámos ${totalAnalisados} instituições disponíveis${
            relaxed ? ' (com critérios flexibilizados)' : ''
          }. A compatibilidade (%) é calculada com dados reais do perfil de cada escola.`,
        }),
        await this.store.addMessage({
          sessionId: session.id,
          role: 'assistant',
          kind: ConciergeMessageKind.text,
          content: `Encontrámos ${enriched.items.length} opções que correspondem ao seu perfil.`,
        }),
      );

      if (enriched.compareSummary) {
        assistantMessages.push(
          await this.store.addMessage({
            sessionId: session.id,
            role: 'assistant',
            kind: ConciergeMessageKind.text,
            content: enriched.compareSummary,
          }),
        );
      }

      assistantMessages.push(
        await this.store.addMessage({
          sessionId: session.id,
          role: 'assistant',
          kind: ConciergeMessageKind.results,
          content: 'Encontrei estas opções para si.',
          colegioIds: resultIds,
        }),
        await this.store.addMessage({
          sessionId: session.id,
          role: 'assistant',
          kind: ConciergeMessageKind.decision,
          content: 'Encontrou uma opção que gostaria de conhecer melhor?',
          colegioIds: resultIds.slice(0, 1),
        }),
      );
    }

    const updated = await this.store.updateNeeds(session.id, needs, {
      phase:
        enriched.items.length > 0
          ? ConciergePhase.results
          : ConciergePhase.adjusting,
      title,
      resultIds,
    });

    return {
      totalAnalisados,
      relaxed,
      matches: enriched.items,
      compareSummary: enriched.compareSummary,
      assistantMessages: assistantMessages.map(presentMessage),
      session: {
        phase: updated.phase,
        resultIds: updated.resultIds,
        title: updated.title,
      },
    };
  }

  private async enrichWithAiExplanations(
    needs: NeedsProfile,
    items: Match[],
  ): Promise<{
    items: Match[];
    compareSummary: string | null;
  }> {
    if (!items.length) {
      return { items: [], compareSummary: null };
    }

    const ai = await this.ollama.explainMatches(
      needs,
      items.map((m) => ({
        schoolId: m.school.id,
        name: m.school.name,
        score: m.score,
        factualReasons: m.motivos,
        municipality: m.school.location?.municipality ?? null,
        province: m.school.location?.province ?? null,
        tuitionFrom: m.school.pricing.tuitionFrom,
        feesAreFree: Boolean(m.school.pricing.feesAreFree),
        services: m.school.services.map((s) => s.label),
        classes: m.school.classes,
        ratingAverage: m.school.rating.average,
        vacanciesTotal: m.school.vacanciesTotal,
        teachingType: m.school.teachingType,
      })),
    );

    const byId = new Map(
      ai.explanations.map((e) => [e.schoolId, e.text] as const),
    );

    const withText = items.map((m) => ({
      ...m,
      explicacao: byId.get(m.school.id) ?? null,
    }));

    return {
      items: withText,
      compareSummary: ai.compareSummary,
    };
  }

  private async runSearch(
    needs: NeedsProfile,
    limit: number,
  ): Promise<{ items: Match[]; totalAnalisados: number }> {
    const filters = needsToMarketplaceFilters(needs);
    const result = await this.marketplaceSearch.execute({
      ...filters,
      sort: 'recommended',
      page: 1,
      pageSize: 48,
    });

    const items: Match[] = result.items.slice(0, limit).map((school) => ({
      school,
      score: school.compatibility.score,
      motivos: this.buildMotivos(school, needs),
      explicacao: null,
    }));

    return {
      items,
      totalAnalisados: result.pagination.totalItems,
    };
  }

  private buildMotivos(
    school: MarketplaceSchoolCard,
    needs: NeedsProfile,
  ): string[] {
    const motivos: string[] = [];
    if (
      needs.precoMax != null &&
      school.pricing.tuitionFrom != null &&
      school.pricing.tuitionFrom <= needs.precoMax
    ) {
      motivos.push(
        needs.precoMax === 0 || school.pricing.feesAreFree
          ? 'Ensino gratuito / dentro do orçamento'
          : 'Está dentro do seu orçamento',
      );
    }
    if (
      needs.municipio &&
      school.location?.municipality
        ?.toLowerCase()
        .includes(needs.municipio.toLowerCase())
    ) {
      motivos.push('Fica na localização indicada');
    }
    if (
      needs.transporte === true &&
      school.services.some((s) => s.id === 'transporte')
    ) {
      motivos.push('Possui transporte escolar');
    }
    if (
      needs.classe &&
      school.classes.some((c) =>
        c
          .toLowerCase()
          .includes(needs.classe.toLowerCase().replace(' classe', '')),
      )
    ) {
      motivos.push(`Tem vagas para a ${needs.classe}`);
    }
    if (school.vacanciesTotal > 0) {
      motivos.push('Tem vaga disponível');
    }
    if (needs.tipoEnsino) {
      const tipo = needs.tipoEnsino.toLowerCase();
      if (
        (tipo.includes('públic') && school.teachingType === 'PUBLIC') ||
        (tipo.includes('privado') && school.teachingType === 'PRIVATE')
      ) {
        motivos.push(`Tipo de instituição: ${needs.tipoEnsino}`);
      }
    }
    return motivos.slice(0, 4);
  }
}
