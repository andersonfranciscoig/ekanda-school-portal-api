import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { BusinessRuleViolationException } from '../../../../shared/domain/exceptions/domain.exception';
import { EMPTY_NEEDS } from '../../../concierge/domain/concierge.types';
import { OllamaConciergeClient } from '../../../concierge/infrastructure/ollama/ollama-concierge.client';
import {
  MarketplaceSchoolCard,
  MarketplaceSearchFilters,
} from '../../domain/marketplace-search.types';
import { toMarketplaceCard } from '../../domain/services/marketplace-card.mapper';
import { PrismaMarketplaceSearchQuery } from '../../infrastructure/persistence/prisma/prisma-marketplace-search.query';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const COMPARE_FILTERS: MarketplaceSearchFilters = {
  serviceIds: [],
  fullDay: false,
  sort: 'recommended',
  page: 1,
  pageSize: 3,
};

export type CompareSchoolsInput = {
  ids?: string | string[];
  /** Preferências opcionais (ex.: orçamento) para contextualizar a IA. */
  tuitionMax?: number;
  municipality?: string;
  province?: string;
};

export type CompareSchoolExplanation = {
  schoolId: string;
  text: string;
};

export type CompareSchoolsResult = {
  items: MarketplaceSchoolCard[];
  /** Explicações IA grounded nos factos reais (pode estar vazio se Ollama off). */
  explanations: CompareSchoolExplanation[];
  compareSummary: string | null;
};

@Injectable()
export class CompareSchoolsUseCase
  implements UseCase<CompareSchoolsInput, CompareSchoolsResult>
{
  constructor(
    private readonly query: PrismaMarketplaceSearchQuery,
    private readonly ollama: OllamaConciergeClient,
  ) {}

  async execute(input: CompareSchoolsInput): Promise<CompareSchoolsResult> {
    const ids = this.parseIds(input.ids);
    if (ids.length < 2) {
      throw new BusinessRuleViolationException(
        'Select at least 2 schools to compare',
      );
    }

    const rows = await this.query.findVisibleByIds(ids);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const items = ids
      .map((id) => {
        const row = byId.get(id);
        return row ? toMarketplaceCard(row, COMPARE_FILTERS) : null;
      })
      .filter((card): card is MarketplaceSchoolCard => Boolean(card));

    const needs = {
      ...EMPTY_NEEDS,
      ...(input.municipality?.trim()
        ? { municipio: input.municipality.trim() }
        : {}),
      ...(input.province?.trim() ? { provincia: input.province.trim() } : {}),
      ...(typeof input.tuitionMax === 'number' && Number.isFinite(input.tuitionMax)
        ? { precoMax: input.tuitionMax }
        : {}),
    };

    const ai = await this.ollama.explainMatches(
      needs,
      items.map((school) => ({
        schoolId: school.id,
        name: school.name,
        score: school.compatibility.score,
        factualReasons: school.compatibility.reasons,
        municipality: school.location?.municipality ?? null,
        province: school.location?.province ?? null,
        tuitionFrom: school.pricing.tuitionFrom,
        feesAreFree: Boolean(school.pricing.feesAreFree),
        services: school.services.map((s) => s.label),
        classes: school.classes,
        ratingAverage: school.rating.average,
        vacanciesTotal: school.vacanciesTotal,
        teachingType: school.teachingType,
      })),
    );

    return {
      items,
      explanations: ai.explanations,
      compareSummary: ai.compareSummary,
    };
  }

  private parseIds(raw?: string | string[]): string[] {
    const parts = Array.isArray(raw)
      ? raw
      : typeof raw === 'string'
        ? raw.split(',')
        : [];
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const part of parts) {
      const id = part.trim();
      if (!UUID_RE.test(id) || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
      if (ids.length >= 3) break;
    }
    return ids;
  }
}
