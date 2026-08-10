import {
  EducationLevelCode,
  SchoolClassShift,
  SchoolServiceCatalogId,
} from '../../school/domain/school.enums';

export type MarketplaceSort =
  | 'recommended'
  | 'nearest'
  | 'tuition_asc'
  | 'rating_desc'
  | 'services_desc';

export type MarketplaceTeachingType =
  | 'PRIVATE'
  | 'SEMI_PRIVATE'
  | 'INTERNATIONAL';

export type MarketplaceSearchFilters = {
  q?: string | null;
  province?: string | null;
  municipality?: string | null;
  classLabel?: string | null;
  tuitionMax?: number | null;
  serviceIds: SchoolServiceCatalogId[];
  fullDay: boolean;
  teachingType?: MarketplaceTeachingType | null;
  sort: MarketplaceSort;
  page: number;
  pageSize: number;
  lat?: number | null;
  lng?: number | null;
};

export type MarketplaceSchoolCard = {
  id: string;
  slug: string;
  name: string;
  acronym: string;
  logoUrl: string | null;
  coverUrl: string | null;
  location: {
    province: string;
    municipality: string;
    neighborhood: string | null;
  } | null;
  distanceKm: number | null;
  rating: {
    average: number;
    count: number;
  };
  pricing: {
    tuitionFrom: number | null;
    enrollmentFrom: number | null;
    currency: string;
  };
  classes: string[];
  services: Array<{ id: string; label: string }>;
  teachingType: MarketplaceTeachingType;
  fullDay: boolean;
  vacanciesTotal: number;
  highlight: string | null;
  compatibility: {
    score: number;
    reasons: string[];
  };
  createdAt: string;
};

export type MarketplaceFacetValue = {
  value: string;
  count: number;
  label?: string;
};

export type MarketplaceSearchResult = {
  items: MarketplaceSchoolCard[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  facets: {
    provinces: MarketplaceFacetValue[];
    municipalities: MarketplaceFacetValue[];
    classLabels: MarketplaceFacetValue[];
    teachingTypes: Array<MarketplaceFacetValue & { label: string }>;
    services: Array<{ id: string; label: string; count: number }>;
    tuition: { min: number | null; max: number | null };
  };
  appliedFilters: {
    q: string;
    province: string | null;
    municipality: string | null;
    classLabel: string | null;
    tuitionMax: number | null;
    serviceIds: string[];
    fullDay: boolean;
    teachingType: MarketplaceTeachingType | null;
    sort: MarketplaceSort;
  };
};

export const MARKETPLACE_SERVICE_LABELS: Record<SchoolServiceCatalogId, string> =
  {
    [SchoolServiceCatalogId.TRANSPORTE]: 'Transporte',
    [SchoolServiceCatalogId.CANTINA]: 'Cantina',
    [SchoolServiceCatalogId.BIBLIOTECA]: 'Biblioteca',
    [SchoolServiceCatalogId.LABORATORIO]: 'Laboratório',
    [SchoolServiceCatalogId.CAMPO]: 'Campo',
    [SchoolServiceCatalogId.INFORMATICA]: 'Informática',
    [SchoolServiceCatalogId.INGLES]: 'Inglês',
    [SchoolServiceCatalogId.SEGURANCA]: 'Segurança',
    [SchoolServiceCatalogId.ENFERMARIA]: 'Enfermaria',
    [SchoolServiceCatalogId.EXTRA]: 'Extra',
  };

export const MARKETPLACE_TEACHING_TYPE_LABELS: Record<
  MarketplaceTeachingType,
  string
> = {
  PRIVATE: 'Privado',
  SEMI_PRIVATE: 'Semi-privado',
  INTERNATIONAL: 'Internacional',
};

export type MarketplaceSchoolRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  createdAt: Date;
  location: {
    province: string;
    municipality: string;
    neighborhood: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  classes: Array<{
    classLabel: string;
    vacancies: number;
    shift: SchoolClassShift | string;
    isActive: boolean;
  }>;
  services: Array<{ serviceId: SchoolServiceCatalogId | string }>;
  price: {
    currency: string;
    levels: Array<{
      levelId: EducationLevelCode | string;
      enrollmentFeeMin: number | null;
      tuitionFeeMin: number | null;
    }>;
  } | null;
  gallery: Array<{ url: string; kind: string; order: number }>;
  reviews: Array<{ rating: number }>;
};
