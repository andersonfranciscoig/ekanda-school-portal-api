import { EMPTY_NEEDS } from '../../domain/concierge.types';
import { parseConciergeTurnDeterministic } from '../../domain/services/deterministic-needs.parser';

describe('parseConciergeTurnDeterministic', () => {
  it('extracts municipio, classe, preco and transporte from a full message', () => {
    const result = parseConciergeTurnDeterministic(
      'Procuro um colégio em Talatona para a 5ª classe até 50.000 Kz com transporte',
      EMPTY_NEEDS,
    );

    expect(result.needsPatch.municipio).toBe('Talatona');
    expect(result.needsPatch.provincia).toBe('Luanda');
    expect(result.needsPatch.classe).toBe('5.ª classe');
    expect(result.needsPatch.precoMax).toBe(50000);
    expect(result.needsPatch.transporte).toBe(true);
    expect(result.actions.shouldSearch).toBe(true);
    expect(result.intent).toBe('ready_to_search');
  });

  it('asks for the next missing field when incomplete', () => {
    const result = parseConciergeTurnDeterministic(
      'Quero um colégio em Belas',
      EMPTY_NEEDS,
    );

    expect(result.needsPatch.municipio).toBe('Belas');
    expect(result.actions.shouldSearch).toBe(false);
    expect(result.intent).toBe('ask_question');
    expect(result.reply.toLowerCase()).toContain('classe');
  });

  it('detects compareTop intent', () => {
    const result = parseConciergeTurnDeterministic(
      'Quero comparar os dois',
      {
        ...EMPTY_NEEDS,
        municipio: 'Talatona',
        classe: '5.ª classe',
        precoMax: 50000,
        transporte: true,
      },
    );

    expect(result.actions.compareTop).toBe(2);
    expect(result.intent).toBe('compare');
    expect(result.actions.shouldSearch).toBe(false);
  });

  it('detects softAdjust cheaper', () => {
    const result = parseConciergeTurnDeterministic('Quero opções mais baratas', {
      ...EMPTY_NEEDS,
      municipio: 'Talatona',
      classe: '5.ª classe',
      precoMax: 50000,
      transporte: true,
    });

    expect(result.actions.softAdjust).toBe('cheaper');
    expect(result.actions.shouldSearch).toBe(true);
    expect(result.intent).toBe('soft_adjust');
  });
});
