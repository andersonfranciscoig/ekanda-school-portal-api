import { SchoolClassShift, SchoolServiceCatalogId } from '../../../school/domain/school.enums';
import { MarketplaceSchoolRow } from '../marketplace-search.types';
import {
  buildAcronym,
  computeCompatibility,
  haversineKm,
  sortMarketplaceCards,
  toMarketplaceCard,
} from './marketplace-card.mapper';

describe('marketplace-card.mapper', () => {
  const baseRow: MarketplaceSchoolRow = {
    id: 'school-1',
    slug: 'colegio-horizonte',
    name: 'Colégio Horizonte Internacional',
    description: 'Laboratórios equipados e turmas até 20 alunos.',
    logoUrl: 'https://cdn/logo.png',
    coverImageUrl: null,
    createdAt: new Date('2026-07-28T09:14:00.000Z'),
    location: {
      province: 'Luanda',
      municipality: 'Talatona',
      neighborhood: 'Via Expressa',
      latitude: -8.9,
      longitude: 13.2,
    },
    classes: [
      {
        classLabel: '1.ª',
        vacancies: 10,
        shift: SchoolClassShift.MORNING,
        isActive: true,
      },
      {
        classLabel: 'Pré-escolar',
        vacancies: 14,
        shift: SchoolClassShift.DOUBLE,
        isActive: true,
      },
    ],
    services: [
      { serviceId: SchoolServiceCatalogId.TRANSPORTE },
      { serviceId: SchoolServiceCatalogId.INGLES },
    ],
    price: {
      currency: 'AOA',
      levels: [
        {
          levelId: 'creche',
          enrollmentFeeMin: 60000,
          tuitionFeeMin: 45000,
        },
        {
          levelId: 'primario',
          enrollmentFeeMin: 70000,
          tuitionFeeMin: 55000,
        },
      ],
    },
    gallery: [
      { url: 'https://cdn/cover.webp', kind: 'PHOTO', order: 0 },
    ],
    reviews: [{ rating: 5 }, { rating: 4 }],
  };

  const filters = {
    q: null,
    province: 'Luanda',
    municipality: null,
    classLabel: null,
    tuitionMax: 50000,
    serviceIds: [SchoolServiceCatalogId.TRANSPORTE],
    fullDay: true,
    teachingType: null,
    sort: 'recommended' as const,
    page: 1,
    pageSize: 12,
    lat: -8.91,
    lng: 13.21,
  };

  it('maps card fields for SchoolCard', () => {
    const card = toMarketplaceCard(baseRow, filters);
    expect(card.acronym).toBe('CHI');
    expect(card.coverUrl).toBe('https://cdn/cover.webp');
    expect(card.pricing.tuitionFrom).toBe(45000);
    expect(card.pricing.enrollmentFrom).toBe(60000);
    expect(card.fullDay).toBe(true);
    expect(card.vacanciesTotal).toBe(24);
    expect(card.rating).toEqual({ average: 4.5, count: 2 });
    expect(card.teachingType).toBe('PRIVATE');
    expect(card.services[0]).toEqual({
      id: 'transporte',
      label: 'Transporte',
    });
    expect(card.distanceKm).not.toBeNull();
    expect(card.compatibility.score).toBeGreaterThan(50);
  });

  it('buildAcronym skips particles', () => {
    expect(buildAcronym('Colégio de Cristo Rei')).toBe('CCR');
  });

  it('haversine returns ~0 for same point', () => {
    expect(haversineKm(-8.9, 13.2, -8.9, 13.2)).toBeCloseTo(0, 5);
  });

  it('sorts by tuition ascending', () => {
    const a = toMarketplaceCard(baseRow, filters);
    const b = toMarketplaceCard(
      {
        ...baseRow,
        id: 'school-2',
        price: {
          currency: 'AOA',
          levels: [{ levelId: 'creche', enrollmentFeeMin: 1, tuitionFeeMin: 20000 }],
        },
      },
      filters,
    );
    const sorted = sortMarketplaceCards([a, b], 'tuition_asc');
    expect(sorted[0].id).toBe('school-2');
  });

  it('compatibility rewards budget and services', () => {
    const card = toMarketplaceCard(baseRow, filters);
    const { score, reasons } = computeCompatibility(card, filters);
    expect(score).toBeGreaterThanOrEqual(70);
    expect(reasons.join(' ')).toMatch(/orçamento|serviços|vaga|integral/i);
  });
});
