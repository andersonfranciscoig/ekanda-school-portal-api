import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { BusinessRuleViolationException } from '../../../../shared/domain/exceptions/domain.exception';
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
};

export type CompareSchoolsResult = {
  items: MarketplaceSchoolCard[];
};

@Injectable()
export class CompareSchoolsUseCase
  implements UseCase<CompareSchoolsInput, CompareSchoolsResult>
{
  constructor(private readonly query: PrismaMarketplaceSearchQuery) {}

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

    return { items };
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
