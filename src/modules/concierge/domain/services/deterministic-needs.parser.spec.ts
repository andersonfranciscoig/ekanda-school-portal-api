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

  it('does not treat "perto de mim" as municipio and reads Luanda', () => {
    const result = parseConciergeTurnDeterministic(
      'Procuro um colégio perto de mim, estou em Luanda',
      EMPTY_NEEDS,
    );

    expect(result.needsPatch.municipio).not.toBe('mim');
    expect(result.needsPatch.provincia).toBe('Luanda');
    expect(result.needsPatch.municipio).toBe('Luanda');
    expect(result.reply.toLowerCase()).not.toContain('anotei mim');
  });

  it('does not set budget from "qualquer classe"', () => {
    const base = {
      ...EMPTY_NEEDS,
      municipio: 'Talatona',
      provincia: 'Luanda',
      classe: 'Pré-escolar',
    };
    const result = parseConciergeTurnDeterministic('Qualquer classe', base);
    expect(result.needsPatch.precoMax).toBeUndefined();
    expect(result.actions.shouldSearch).toBe(false);
  });

  it('treats dual municipalities as province-wide search', () => {
    const both = parseConciergeTurnDeterministic('Talatona ou Belas', EMPTY_NEEDS);
    expect(both.needsPatch.municipio).toBe('');
    expect(both.needsPatch.provincia).toBe('Luanda');

    const confirm = parseConciergeTurnDeterministic('Podes pesquisar pelos dois', {
      ...EMPTY_NEEDS,
      municipio: 'Talatona',
      provincia: 'Luanda',
    });
    expect(confirm.needsPatch.municipio).toBe('');
    expect(confirm.needsPatch.provincia).toBe('Luanda');
  });

  it('does not map price talk to transporte while awaiting it', () => {
    const awaiting = {
      ...EMPTY_NEEDS,
      municipio: 'Talatona',
      classe: 'Pré-escolar',
      precoMax: null,
      transporte: null,
    };
    // awaiting is precoMax here actually - set precoMax filled
    const withPricePendingTransport = {
      ...awaiting,
      precoMax: 150000,
    };
    const result = parseConciergeTurnDeterministic(
      'Nao tenho um Preço máximo, qualquer Preço serve',
      withPricePendingTransport,
    );
    expect(result.needsPatch.transporte).toBeUndefined();
    expect(result.needsPatch.precoMax).toBe(150000);
    expect(result.actions.shouldSearch).toBe(false);
    expect(result.reply.toLowerCase()).toContain('transporte');
  });

  it('treats "qualquer valor" / "sem preferência" as flexible budget', () => {
    const base = {
      ...EMPTY_NEEDS,
      municipio: 'Luanda',
      classe: 'Pré-escolar',
    };

    const a = parseConciergeTurnDeterministic('qualquer valor', base);
    expect(a.needsPatch.precoMax).toBe(150000);

    const b = parseConciergeTurnDeterministic('sem preferencia', base);
    expect(b.needsPatch.precoMax).toBe(150000);
    expect(b.needsPatch.municipio).toBeUndefined();
  });

  it('accepts short yes/no/optional when awaiting transporte', () => {
    const awaiting = {
      ...EMPTY_NEEDS,
      municipio: 'Luanda',
      classe: 'Pré-escolar',
      precoMax: 45000,
      transporte: null,
    };

    expect(parseConciergeTurnDeterministic('sim', awaiting).needsPatch.transporte).toBe(
      true,
    );
    expect(parseConciergeTurnDeterministic('Não', awaiting).needsPatch.transporte).toBe(
      false,
    );
    expect(
      parseConciergeTurnDeterministic('não preciso', awaiting).needsPatch.transporte,
    ).toBe(false);
    expect(
      parseConciergeTurnDeterministic('E opcional o trasporte escolar', awaiting)
        .needsPatch.transporte,
    ).toBe(false);
    expect(
      parseConciergeTurnDeterministic('Podemos avançar', awaiting).needsPatch
        .transporte,
    ).toBe(false);
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
    const result = parseConciergeTurnDeterministic('Quero comparar os dois', {
      ...EMPTY_NEEDS,
      municipio: 'Talatona',
      classe: '5.ª classe',
      precoMax: 50000,
      transporte: true,
    });

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
