import type { MarketplaceSchoolCard } from '../../../marketplace/domain/marketplace-search.types';
import {
  answerFromResults,
  detectResultsTopic,
  isOffTopicMessage,
  isResultsFollowUpContext,
} from './answer-from-results';
import { EMPTY_NEEDS } from '../concierge.types';
import { parseConciergeTurnDeterministic } from './deterministic-needs.parser';

function card(
  partial: Partial<MarketplaceSchoolCard> & { id: string; name: string },
): MarketplaceSchoolCard {
  return {
    slug: partial.slug ?? partial.name.toLowerCase().replace(/\s+/g, '-'),
    acronym: partial.acronym ?? 'XX',
    logoUrl: null,
    coverUrl: null,
    location: partial.location ?? {
      province: 'Luanda',
      municipality: 'Talatona',
      neighborhood: 'Talatona',
    },
    distanceKm: partial.distanceKm ?? 10,
    rating: partial.rating ?? { average: 4.5, count: 3 },
    pricing: partial.pricing ?? {
      tuitionFrom: 50000,
      enrollmentFrom: 10000,
      currency: 'AOA',
      feesAreFree: false,
    },
    classes: partial.classes ?? ['5.ª classe'],
    services: partial.services ?? [],
    teachingType: partial.teachingType ?? 'PRIVATE',
    fullDay: false,
    vacanciesTotal: partial.vacanciesTotal ?? 12,
    highlight: null,
    compatibility: partial.compatibility ?? { score: 80, reasons: [] },
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

describe('answer-from-results', () => {
  const schools = [
    card({
      id: '1',
      name: 'Gira Sol',
      pricing: {
        tuitionFrom: 0,
        enrollmentFrom: 0,
        currency: 'AOA',
        feesAreFree: true,
      },
      distanceKm: 16.5,
    }),
    card({
      id: '2',
      name: 'Colégio Amanhecer',
      pricing: {
        tuitionFrom: 123,
        enrollmentFrom: 50,
        currency: 'AOA',
        feesAreFree: false,
      },
      distanceKm: 18,
    }),
    card({
      id: '3',
      name: 'Complexo Cristo Rei da Paz',
      location: {
        province: 'Luanda',
        municipality: 'Belas',
        neighborhood: null,
      },
      pricing: {
        tuitionFrom: 1000,
        enrollmentFrom: 200,
        currency: 'AOA',
        feesAreFree: false,
      },
      distanceKm: 22,
    }),
  ];

  it('detects free / location follow-up topics', () => {
    expect(
      detectResultsTopic(
        'Boas entre essas escolas qual delas e gratuita?',
      ),
    ).toBe('free');
    expect(detectResultsTopic('Podes dar a localizacao desta escola?')).toBe(
      'location',
    );
    expect(detectResultsTopic('qual está mais perto?')).toBe('closest');
  });

  it('answers which school is free without inventing', () => {
    const reply = answerFromResults('free', schools, 'qual é gratuita?');
    expect(reply).toMatch(/Gira Sol/i);
    expect(reply.toLowerCase()).toMatch(/gratuit/);
    expect(reply).toMatch(/Amanhecer|Cristo Rei/i);
  });

  it('answers location of current school', () => {
    const reply = answerFromResults(
      'location',
      schools,
      'localizacao desta escola',
    );
    expect(reply).toMatch(/Gira Sol/i);
    expect(reply).toMatch(/Talatona/i);
    expect(reply).toMatch(/\[Abrir no mapa\]\(https:\/\/www\.google\.com\/maps/);
    expect(reply).toMatch(/\[Ver perfil de Gira Sol\]\(\/colegio\/gira-sol\)/);
  });

  it('answers schedule visit with link', () => {
    expect(detectResultsTopic('quero visitar o Gira Sol')).toBe(
      'schedule_visit',
    );
    const reply = answerFromResults(
      'schedule_visit',
      schools,
      'quero visitar o Gira Sol',
      'sess-1',
    );
    expect(reply).toMatch(/\[Agendar visita a Gira Sol\]\(\/concierge\/visita\/gira-sol\?sessao=sess-1\)/);
  });

  it('treats follow-ups as results context', () => {
    expect(
      isResultsFollowUpContext('qual delas é gratuita?'),
    ).toBe(true);
    expect(isResultsFollowUpContext('procuro outras opções em Viana')).toBe(
      false,
    );
  });

  it('flags obvious off-topic', () => {
    expect(isOffTopicMessage('quem ganhou o jogo de futebol ontem?')).toBe(
      true,
    );
    expect(isOffTopicMessage('procuro escola em Luanda')).toBe(false);
  });
});

describe('parseConciergeTurnDeterministic with hasResults', () => {
  const readyNeeds = {
    ...EMPTY_NEEDS,
    provincia: 'Luanda',
    browseWide: true,
    precoMax: 150000,
    transporte: false,
  };

  it('does not re-search when asking which is free among results', () => {
    const result = parseConciergeTurnDeterministic(
      'entre essas escolas qual delas é gratuita?',
      readyNeeds,
      { hasResults: true },
    );
    expect(result.actions.shouldSearch).toBe(false);
    expect(result.intent).toBe('answer_from_results');
    expect(result.resultsTopic).toBe('free');
    expect(result.needsPatch.precoMax).toBeUndefined();
  });

  it('does not re-search on location follow-up', () => {
    const result = parseConciergeTurnDeterministic(
      'podes dar a localizacao desta escola?',
      readyNeeds,
      { hasResults: true },
    );
    expect(result.actions.shouldSearch).toBe(false);
    expect(result.intent).toBe('answer_from_results');
    expect(result.resultsTopic).toBe('location');
  });

  it('still searches for a fresh free-school request without results', () => {
    const result = parseConciergeTurnDeterministic(
      'Procuro escola pública gratuita em Luanda',
      EMPTY_NEEDS,
      { hasResults: false },
    );
    expect(result.actions.shouldSearch).toBe(true);
    expect(result.needsPatch.precoMax).toBe(0);
  });
});
