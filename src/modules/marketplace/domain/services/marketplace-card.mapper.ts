import {
  SchoolClassShift,
  SchoolServiceCatalogId,
} from '../../../school/domain/school.enums';
import {
  MARKETPLACE_SERVICE_LABELS,
  MarketplaceSchoolCard,
  MarketplaceSchoolRow,
  MarketplaceSearchFilters,
  MarketplaceTeachingType,
} from '../marketplace-search.types';

const EARTH_RADIUS_KM = 6371;

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function buildAcronym(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0 && !/^(de|da|do|das|dos|e)$/i.test(part));
  if (parts.length === 0) return 'SC';
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts
    .slice(0, 3)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

export function minFee(
  values: Array<number | null | undefined>,
): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number');
  if (nums.length === 0) return null;
  return Math.min(...nums);
}

export function averageRating(ratings: number[]): {
  average: number;
  count: number;
} {
  if (ratings.length === 0) return { average: 0, count: 0 };
  const sum = ratings.reduce((acc, n) => acc + n, 0);
  return {
    average: Math.round((sum / ratings.length) * 10) / 10,
    count: ratings.length,
  };
}

export function computeCompatibility(
  card: Omit<MarketplaceSchoolCard, 'compatibility'>,
  filters: MarketplaceSearchFilters,
): { score: number; reasons: string[] } {
  let score = 40;
  const reasons: string[] = [];

  if (filters.province && card.location?.province === filters.province) {
    score += 12;
    reasons.push('Na província seleccionada');
  }
  if (
    filters.municipality &&
    card.location?.municipality === filters.municipality
  ) {
    score += 8;
    reasons.push('No município seleccionado');
  }
  if (
    filters.tuitionMax != null &&
    card.pricing.tuitionFrom != null &&
    card.pricing.tuitionFrom <= filters.tuitionMax
  ) {
    score += 15;
    reasons.push('Dentro do orçamento');
  }
  if (filters.serviceIds.length > 0) {
    const hasAll = filters.serviceIds.every((id) =>
      card.services.some((s) => s.id === id),
    );
    if (hasAll) {
      score += 12;
      reasons.push('Possui os serviços pedidos');
    }
  }
  if (filters.fullDay && card.fullDay) {
    score += 8;
    reasons.push('Oferece período integral');
  }
  if (filters.classLabel && card.classes.includes(filters.classLabel)) {
    score += 8;
    reasons.push('Tem a classe pretendida');
  }
  if (card.vacanciesTotal > 0) {
    score += 7;
    reasons.push('Tem vaga disponível');
  }
  if (card.distanceKm != null && card.distanceKm <= 10) {
    score += 8;
    reasons.push('Próximo da localização');
  }
  if (card.rating.average >= 4) {
    score += 5;
    reasons.push('Boa avaliação');
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    reasons: reasons.slice(0, 4),
  };
}

export function toMarketplaceCard(
  row: MarketplaceSchoolRow,
  filters: MarketplaceSearchFilters,
): MarketplaceSchoolCard {
  const activeClasses = row.classes.filter((c) => c.isActive);
  const tuitionFrom = minFee(
    row.price?.levels.map((l) => l.tuitionFeeMin) ?? [],
  );
  const enrollmentFrom = minFee(
    row.price?.levels.map((l) => l.enrollmentFeeMin) ?? [],
  );
  const services = row.services.map((s) => {
    const id = String(s.serviceId).toLowerCase() as SchoolServiceCatalogId;
    return {
      id,
      label: MARKETPLACE_SERVICE_LABELS[id] ?? String(s.serviceId),
    };
  });
  const coverPhoto = [...row.gallery]
    .filter((g) => g.kind === 'PHOTO')
    .sort((a, b) => a.order - b.order)[0];
  const fullDay = activeClasses.some((c) => c.shift === SchoolClassShift.DOUBLE);
  const vacanciesTotal = activeClasses.reduce((sum, c) => sum + c.vacancies, 0);
  const rating = averageRating(row.reviews.map((r) => r.rating));

  let distanceKm: number | null = null;
  if (
    filters.lat != null &&
    filters.lng != null &&
    row.location?.latitude != null &&
    row.location?.longitude != null
  ) {
    distanceKm =
      Math.round(
        haversineKm(
          filters.lat,
          filters.lng,
          row.location.latitude,
          row.location.longitude,
        ) * 10,
      ) / 10;
  }

  const teachingType: MarketplaceTeachingType =
    row.institutionType === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE';
  const feesAreFree =
    Boolean(row.price?.feesAreFree) ||
    (tuitionFrom != null && tuitionFrom === 0);
  const partial: Omit<MarketplaceSchoolCard, 'compatibility'> = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    acronym: buildAcronym(row.name),
    logoUrl: row.logoUrl,
    coverUrl: coverPhoto?.url ?? row.coverImageUrl ?? row.logoUrl,
    location: row.location
      ? {
          province: row.location.province,
          municipality: row.location.municipality,
          neighborhood: row.location.neighborhood,
        }
      : null,
    distanceKm,
    rating,
    pricing: {
      tuitionFrom: feesAreFree ? 0 : tuitionFrom,
      enrollmentFrom: feesAreFree ? 0 : enrollmentFrom,
      currency: row.price?.currency ?? 'AOA',
      feesAreFree,
    },
    classes: activeClasses.map((c) => c.classLabel),
    services,
    teachingType,
    fullDay,
    vacanciesTotal,
    highlight: row.description?.trim()
      ? row.description.trim().slice(0, 160)
      : null,
    createdAt: row.createdAt.toISOString(),
  };

  return {
    ...partial,
    compatibility: computeCompatibility(partial, filters),
  };
}

export function sortMarketplaceCards(
  cards: MarketplaceSchoolCard[],
  sort: MarketplaceSearchFilters['sort'],
): MarketplaceSchoolCard[] {
  const copy = [...cards];
  switch (sort) {
    case 'nearest':
      return copy.sort((a, b) => {
        if (a.distanceKm == null && b.distanceKm == null) return 0;
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    case 'tuition_asc':
      return copy.sort((a, b) => {
        if (a.pricing.tuitionFrom == null && b.pricing.tuitionFrom == null)
          return 0;
        if (a.pricing.tuitionFrom == null) return 1;
        if (b.pricing.tuitionFrom == null) return -1;
        return a.pricing.tuitionFrom - b.pricing.tuitionFrom;
      });
    case 'rating_desc':
      return copy.sort((a, b) => {
        if (b.rating.average !== a.rating.average) {
          return b.rating.average - a.rating.average;
        }
        return b.rating.count - a.rating.count;
      });
    case 'services_desc':
      return copy.sort((a, b) => b.services.length - a.services.length);
    case 'recommended':
    default:
      return copy.sort((a, b) => {
        if (b.compatibility.score !== a.compatibility.score) {
          return b.compatibility.score - a.compatibility.score;
        }
        return b.rating.average - a.rating.average;
      });
  }
}
