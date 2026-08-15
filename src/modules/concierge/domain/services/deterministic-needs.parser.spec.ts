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

  it('recognizes escola pública gratuita as precoMax=0 and tipo Pública', () => {
    const result = parseConciergeTurnDeterministic(
      'Procuro escola pública gratuita em Luanda para a 1ª classe sem transporte',
      EMPTY_NEEDS,
    );

    expect(result.needsPatch.tipoEnsino).toBe('Pública');
    expect(result.needsPatch.precoMax).toBe(0);
    expect(result.needsPatch.provincia).toBe('Luanda');
    expect(result.needsPatch.classe).toBe('1.ª classe');
    expect(result.actions.shouldSearch).toBe(true);
  });

  it('does not treat "perto de mim" as municipio and reads Luanda as province', () => {
    const result = parseConciergeTurnDeterministic(
      'Procuro um colégio perto de mim, estou em Luanda',
      EMPTY_NEEDS,
    );

    expect(result.needsPatch.municipio).not.toBe('mim');
    expect(result.needsPatch.provincia).toBe('Luanda');
    expect(result.needsPatch.municipio).toBe('');
    expect(result.reply.toLowerCase()).not.toContain('anotei mim');
  });

  it('searches public free schools in Luanda without asking for class', () => {
    const result = parseConciergeTurnDeterministic(
      'Procuro escola pública gratuita em Luanda',
      EMPTY_NEEDS,
    );
    expect(result.needsPatch.provincia).toBe('Luanda');
    expect(result.needsPatch.tipoEnsino).toBe('Pública');
    expect(result.needsPatch.precoMax).toBe(0);
    expect(result.needsPatch.browseWide).toBe(true);
    expect(result.actions.shouldSearch).toBe(true);
    expect(result.reply.toLowerCase()).not.toMatch(/classe/);
  });

  it('answers distance questions without re-searching', () => {
    const base = {
      ...EMPTY_NEEDS,
      provincia: 'Luanda',
      browseWide: true,
      precoMax: 0,
      transporte: false,
      tipoEnsino: 'Pública',
    };
    const result = parseConciergeTurnDeterministic(
      'de acordo a minha localizao quantos km tem de distancia',
      base,
    );
    expect(result.actions.shouldSearch).toBe(false);
    expect(result.intent).toBe('clarify');
    expect(result.reply.toLowerCase()).toMatch(/dist/);
  });

  it('treats "Lista dos colegios de Luanda" as province-wide browse without asking class', () => {
    const result = parseConciergeTurnDeterministic(
      'Lista dos os colegios de Luanda',
      EMPTY_NEEDS,
    );
    expect(result.needsPatch.provincia).toBe('Luanda');
    expect(result.needsPatch.browseWide).toBe(true);
    expect(result.needsPatch.classe).toBe('');
    expect(result.needsPatch.precoMax).toBe(150000);
    expect(result.needsPatch.transporte).toBe(false);
    expect(result.actions.shouldSearch).toBe(true);
    expect(result.intent).toBe('ready_to_search');
    expect(result.reply.toLowerCase()).not.toContain('qual a classe');
  });

  it('accepts multi-level / several children as browseWide and searches', () => {
    const withLuanda = {
      ...EMPTY_NEEDS,
      provincia: 'Luanda',
      browseWide: true,
      precoMax: 150000,
      transporte: false,
    };
    const result = parseConciergeTurnDeterministic(
      'desde o ensino de infancia ate o ensino medio, tenho varios filhos',
      withLuanda,
    );
    expect(result.needsPatch.browseWide).toBe(true);
    expect(result.actions.shouldSearch).toBe(true);
  });

  it('presents all options without re-asking for class', () => {
    const base = {
      ...EMPTY_NEEDS,
      provincia: 'Luanda',
      browseWide: true,
      precoMax: 150000,
      transporte: false,
    };
    const result = parseConciergeTurnDeterministic(
      'Podes apresentar todas opcoes de colegio depois eu vou avaliar',
      base,
    );
    expect(result.actions.shouldSearch).toBe(true);
    expect(result.reply.toLowerCase()).not.toMatch(/qual (a |é a )?classe/);
  });

  it('treats "todos os colégios de Luanda" as province-wide search', () => {
    const result = parseConciergeTurnDeterministic(
      'Quero todos os colégios de Luanda',
      EMPTY_NEEDS,
    );
    expect(result.needsPatch.provincia).toBe('Luanda');
    expect(result.needsPatch.municipio).toBe('');
    expect(result.needsPatch.browseWide).toBe(true);
    expect(result.actions.shouldSearch).toBe(true);
  });

  it('treats "qualquer classe" as browseWide without inventing a single class', () => {
    const base = {
      ...EMPTY_NEEDS,
      municipio: 'Talatona',
      provincia: 'Luanda',
      classe: 'Pré-escolar',
    };
    const result = parseConciergeTurnDeterministic('Qualquer classe', base);
    expect(result.needsPatch.browseWide).toBe(true);
    expect(result.needsPatch.classe).toBe('');
    expect(result.actions.shouldSearch).toBe(true);
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
