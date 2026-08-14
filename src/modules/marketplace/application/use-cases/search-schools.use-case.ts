import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { SchoolServiceCatalogId } from '../../../school/domain/school.enums';
import {
  MARKETPLACE_SERVICE_LABELS,
  MARKETPLACE_TEACHING_TYPE_LABELS,
  MarketplaceSearchFilters,
  MarketplaceSearchResult,
  MarketplaceSort,
  MarketplaceTeachingType,
} from '../../domain/marketplace-search.types';
import {
  sortMarketplaceCards,
  toMarketplaceCard,
} from '../../domain/services/marketplace-card.mapper';
import { PrismaMarketplaceSearchQuery } from '../../infrastructure/persistence/prisma/prisma-marketplace-search.query';

export type SearchSchoolsInput = {
  q?: string;
  province?: string;
  municipality?: string;
  classLabel?: string;
  tuitionMax?: number;
  serviceIds?: string[] | string;
  fullDay?: boolean | string;
  teachingType?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
  lat?: number;
  lng?: number;
};

@Injectable()
export class SearchSchoolsUseCase
  implements UseCase<SearchSchoolsInput, MarketplaceSearchResult>
{
  constructor(private readonly query: PrismaMarketplaceSearchQuery) {}

  async execute(input: SearchSchoolsInput): Promise<MarketplaceSearchResult> {
    const filters = this.normalizeFilters(input);

    const rows = await this.query.findVisibleSchools(filters);
    const cards = sortMarketplaceCards(
      rows.map((row) => toMarketplaceCard(row, filters)),
      filters.sort,
    );

    const totalItems = cards.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / filters.pageSize));
    const page = Math.min(filters.page, totalPages);
    const start = (page - 1) * filters.pageSize;
    const items = cards.slice(start, start + filters.pageSize);

    return {
      items,
      pagination: {
        page,
        pageSize: filters.pageSize,
        totalItems,
        totalPages: totalItems === 0 ? 0 : totalPages,
      },
      facets: this.buildFacets(cards),
      appliedFilters: {
        q: filters.q ?? '',
        province: filters.province ?? null,
        municipality: filters.municipality ?? null,
        classLabel: filters.classLabel ?? null,
        tuitionMax: filters.tuitionMax ?? null,
        serviceIds: filters.serviceIds,
        fullDay: filters.fullDay,
        teachingType: filters.teachingType ?? null,
        sort: filters.sort,
      },
    };
  }

  private normalizeFilters(input: SearchSchoolsInput): MarketplaceSearchFilters {
    const page = Math.max(1, Number(input.page ?? 1) || 1);
    const pageSize = Math.min(48, Math.max(1, Number(input.pageSize ?? 12) || 12));

    const serviceIds = this.parseServiceIds(input.serviceIds);
    const sort = this.parseSort(input.sort);
    const teachingType = this.parseTeachingType(input.teachingType);
    const fullDay =
      input.fullDay === true ||
      input.fullDay === 'true' ||
      input.fullDay === '1';

    return {
      q: input.q?.trim() || null,
      province: input.province?.trim() || null,
      municipality: input.municipality?.trim() || null,
      classLabel: input.classLabel?.trim() || null,
      tuitionMax:
        input.tuitionMax != null && !Number.isNaN(Number(input.tuitionMax))
          ? Number(input.tuitionMax)
          : null,
      serviceIds,
      fullDay,
      teachingType,
      sort,
      page,
      pageSize,
      lat:
        input.lat != null && !Number.isNaN(Number(input.lat))
          ? Number(input.lat)
          : null,
      lng:
        input.lng != null && !Number.isNaN(Number(input.lng))
          ? Number(input.lng)
          : null,
    };
  }

  private parseServiceIds(
    value?: string[] | string,
  ): SchoolServiceCatalogId[] {
    const raw = Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? value.split(',')
        : [];
    const allowed = new Set(Object.values(SchoolServiceCatalogId));
    const unique = new Set<SchoolServiceCatalogId>();
    for (const item of raw) {
      const normalized = item.trim().toLowerCase();
      if (allowed.has(normalized as SchoolServiceCatalogId)) {
        unique.add(normalized as SchoolServiceCatalogId);
      }
    }
    return [...unique];
  }

  private parseSort(value?: string): MarketplaceSort {
    const allowed: MarketplaceSort[] = [
      'recommended',
      'nearest',
      'tuition_asc',
      'rating_desc',
      'services_desc',
    ];
    if (value && allowed.includes(value as MarketplaceSort)) {
      return value as MarketplaceSort;
    }
    return 'recommended';
  }

  private parseTeachingType(
    value?: string,
  ): MarketplaceTeachingType | null {
    if (!value) return null;
    const allowed: MarketplaceTeachingType[] = [
      'PUBLIC',
      'PRIVATE',
      'SEMI_PRIVATE',
      'INTERNATIONAL',
    ];
    return allowed.includes(value as MarketplaceTeachingType)
      ? (value as MarketplaceTeachingType)
      : null;
  }

  private buildFacets(cards: MarketplaceSearchResult['items']) {
    const countMap = (values: string[]) => {
      const map = new Map<string, number>();
      for (const value of values) {
        map.set(value, (map.get(value) ?? 0) + 1);
      }
      return [...map.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    };

    const provinces = countMap(
      cards
        .map((c) => c.location?.province)
        .filter((v): v is string => Boolean(v)),
    );
    const municipalities = countMap(
      cards
        .map((c) => c.location?.municipality)
        .filter((v): v is string => Boolean(v)),
    );
    const classLabels = countMap(cards.flatMap((c) => c.classes));

    const serviceCounts = new Map<string, number>();
    for (const card of cards) {
      for (const service of card.services) {
        serviceCounts.set(service.id, (serviceCounts.get(service.id) ?? 0) + 1);
      }
    }
    const services = [...serviceCounts.entries()]
      .map(([id, count]) => ({
        id,
        label:
          MARKETPLACE_SERVICE_LABELS[id as SchoolServiceCatalogId] ?? id,
        count,
      }))
      .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));

    const tuitions = cards
      .map((c) => c.pricing.tuitionFrom)
      .filter((v): v is number => v != null);

    const teachingTypeCounts = countMap(cards.map((c) => c.teachingType));

    return {
      provinces,
      municipalities,
      classLabels,
      teachingTypes: teachingTypeCounts.map((row) => ({
        ...row,
        label:
          MARKETPLACE_TEACHING_TYPE_LABELS[
            row.value as MarketplaceTeachingType
          ] ?? row.value,
      })),
      services,
      tuition: {
        min: tuitions.length ? Math.min(...tuitions) : null,
        max: tuitions.length ? Math.max(...tuitions) : null,
      },
    };
  }
}
