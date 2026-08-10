import {
  ConciergeActions,
  ConciergeLlmResult,
  NeedsProfile,
  isNeedsReady,
  mergeNeeds,
  nextMissingField,
} from '../concierge.types';

const CLASS_PATTERNS: Array<{ re: RegExp; value: string }> = [
  { re: /\b(pr[eé]-?\s*escolar|pr[eé] escolar)\b/i, value: 'Pré-escolar' },
  { re: /\bcreche\b/i, value: 'Creche' },
  { re: /\b(1[ªa]|primeira)\s*classe\b/i, value: '1.ª classe' },
  { re: /\b(2[ªa]|segunda)\s*classe\b/i, value: '2.ª classe' },
  { re: /\b(3[ªa]|terceira)\s*classe\b/i, value: '3.ª classe' },
  { re: /\b(4[ªa]|quarta)\s*classe\b/i, value: '4.ª classe' },
  { re: /\b(5[ªa]|quinta)\s*classe\b/i, value: '5.ª classe' },
  { re: /\b(6[ªa]|sexta)\s*classe\b/i, value: '6.ª classe' },
  { re: /\b(7[ªa]|s[eé]tima)\s*classe\b/i, value: '7.ª classe' },
  { re: /\b(8[ªa]|oitava)\s*classe\b/i, value: '8.ª classe' },
  { re: /\b(9[ªa]|nona)\s*classe\b/i, value: '9.ª classe' },
  { re: /\b(10[ªa]|d[eé]cima)\s*classe\b/i, value: '10.ª classe' },
  { re: /\b(11[ªa]|d[eé]cima primeira)\s*classe\b/i, value: '11.ª classe' },
  { re: /\b(12[ªa]|d[eé]cima segunda)\s*classe\b/i, value: '12.ª classe' },
  { re: /\b(\d{1,2})[ªa]?\s*classe\b/i, value: '' }, // filled below
];

const KNOWN_MUNICIPIOS = [
  'Talatona',
  'Belas',
  'Viana',
  'Cacuaco',
  'Cazenga',
  'Kilamba Kiaxi',
  'Maianga',
  'Ingombota',
  'Sambizanga',
  'Rangel',
  'Samba',
  'Benguela',
  'Lobito',
  'Huambo',
  'Lubango',
];

function extractPrice(text: string): number | null {
  const match =
    text.match(
      /(?:at[eé]|max(?:imo)?|or[cç]amento|mensalidade)?\s*(?:de\s*)?(\d{1,3}(?:[.\s]\d{3})+|\d{4,6})\s*(?:kz|kwanzas?)?/i,
    ) ?? text.match(/\b(\d{4,6})\b/);
  if (!match) return null;
  const raw = match[1].replace(/[.\s]/g, '');
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function extractBooleanService(
  text: string,
  positive: RegExp,
  negative: RegExp,
): boolean | null {
  if (negative.test(text)) return false;
  if (positive.test(text)) return true;
  return null;
}

function extractClasse(text: string): string | null {
  for (const pattern of CLASS_PATTERNS) {
    const m = text.match(pattern.re);
    if (!m) continue;
    if (pattern.value) return pattern.value;
    const n = m[1];
    if (n) return `${n}.ª classe`;
  }
  return null;
}

function extractMunicipio(text: string): string | null {
  for (const name of KNOWN_MUNICIPIOS) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(text)) return name;
  }
  const near = text.match(
    /(?:em|no|na|perto\s+de|munic[ií]pio\s+de)\s+([A-Za-zÀ-ú][A-Za-zÀ-ú\s]{2,30})/i,
  );
  if (near?.[1]) {
    const candidate = near[1].trim().replace(/\s+/g, ' ');
    if (!/classe|transporte|col[eé]gio|escola|or[cç]amento/i.test(candidate)) {
      return candidate;
    }
  }
  return null;
}

function askFor(field: string): string {
  switch (field) {
    case 'municipio':
      return 'Em que município procura o colégio? (ex.: Talatona, Belas, Viana)';
    case 'classe':
      return 'Qual é a classe pretendida? (ex.: Pré-escolar, 5.ª classe)';
    case 'precoMax':
      return 'Qual é o orçamento máximo mensal em Kz?';
    case 'transporte':
      return 'Precisa de transporte escolar?';
    default:
      return 'Pode partilhar mais detalhes da sua procura?';
  }
}

/**
 * Parser determinístico (fallback quando Ollama não está disponível).
 */
export function parseConciergeTurnDeterministic(
  message: string,
  current: NeedsProfile,
): ConciergeLlmResult {
  const text = message.trim();
  const lower = text.toLowerCase();
  const patch: Partial<NeedsProfile> = {};

  const municipio = extractMunicipio(text);
  if (municipio) {
    patch.municipio = municipio;
    if (!current.provincia && /talatona|belas|viana|cacuaco|cazenga|maianga|ingombota|kilamba/i.test(municipio)) {
      patch.provincia = 'Luanda';
    }
  }

  const classe = extractClasse(text);
  if (classe) patch.classe = classe;

  const price = extractPrice(text);
  if (price != null) patch.precoMax = price;

  const transporte = extractBooleanService(
    lower,
    /\b(com\s+)?transporte\b|\bpreciso\s+de\s+transporte\b|\bquero\s+transporte\b/,
    /\bsem\s+transporte\b|\bn[aã]o\s+(preciso|quero)\s+(de\s+)?transporte\b/,
  );
  if (transporte !== null) patch.transporte = transporte;

  const cantina = extractBooleanService(
    lower,
    /\bcantina\b/,
    /\bsem\s+cantina\b/,
  );
  if (cantina !== null) patch.cantina = cantina;

  const ingles = extractBooleanService(
    lower,
    /\bingl[eê]s\b/,
    /\bsem\s+ingl[eê]s\b/,
  );
  if (ingles !== null) patch.ingles = ingles;

  const informatica = extractBooleanService(
    lower,
    /\binform[aá]tica\b/,
    /\bsem\s+inform[aá]tica\b/,
  );
  if (informatica !== null) patch.informatica = informatica;

  const integral = extractBooleanService(
    lower,
    /\b(integral|per[ií]odo\s+integral|dia\s+inteiro)\b/,
    /\bsem\s+integral\b|\bmeio\s+per[ií]odo\b/,
  );
  if (integral !== null) patch.integral = integral;

  if (/\bmanh[aã]\b/i.test(text)) patch.turno = 'Manhã';
  if (/\btarde\b/i.test(text)) patch.turno = 'Tarde';

  if (/\bsemi[- ]?privado\b/i.test(text)) patch.tipoEnsino = 'Semi-privado';
  else if (/\binternacional\b/i.test(text)) patch.tipoEnsino = 'Internacional';
  else if (/\bprivado\b/i.test(text)) patch.tipoEnsino = 'Privado';

  let compareTop: 2 | 3 | null = null;
  if (/\bcompara(r)?\s+(os\s+)?tr[eê]s\b/i.test(text) || /\btop\s*3\b/i.test(text)) {
    compareTop = 3;
  } else if (/\bcompara(r)?\s+(os\s+)?dois\b/i.test(text) || /\btop\s*2\b/i.test(text)) {
    compareTop = 2;
  }

  let softAdjust: string | null = null;
  if (/\bmais\s+barat[oa]s?\b|\bmais\s+econ[oó]mic[oa]s?\b/i.test(text)) {
    softAdjust = 'cheaper';
  } else if (/\bs[oó]\s+com\s+transporte\b/i.test(text)) {
    softAdjust = 'only_transport';
  } else if (/\bsem\s+transporte\b/i.test(text)) {
    softAdjust = 'no_transport';
  } else if (/\boutras\s+op[cç][oõ]es\b|\bmais\s+op[cç][oõ]es\b/i.test(text)) {
    softAdjust = 'more_options';
  }

  const merged = mergeNeeds(current, patch);
  const missing = nextMissingField(merged);
  const ready = isNeedsReady(merged);

  const noted: string[] = [];
  if (patch.municipio) noted.push(patch.municipio);
  if (patch.classe) noted.push(patch.classe);
  if (patch.precoMax != null) {
    noted.push(`até ${patch.precoMax.toLocaleString('pt-AO')} Kz`);
  }
  if (patch.transporte === true) noted.push('com transporte');
  if (patch.transporte === false) noted.push('sem transporte');

  let reply: string;
  const actions: ConciergeActions = {
    shouldSearch: false,
    compareTop,
    softAdjust,
  };

  if (compareTop) {
    reply = `Vou preparar a comparação dos ${compareTop} melhores resultados.`;
    return {
      needsPatch: patch,
      reply,
      intent: 'compare',
      actions,
    };
  }

  if (softAdjust) {
    actions.shouldSearch = true;
    reply = 'Vou ajustar a procura com base no seu pedido.';
    return {
      needsPatch: patch,
      reply,
      intent: 'soft_adjust',
      actions,
    };
  }

  if (ready) {
    actions.shouldSearch = true;
    reply =
      noted.length > 0
        ? `Perfeito. Anotei ${noted.join(', ')}. Vou procurar as melhores opções.`
        : 'Perfil completo. Vou procurar as melhores opções.';
    return {
      needsPatch: patch,
      reply,
      intent: 'ready_to_search',
      actions,
    };
  }

  const prefix =
    noted.length > 0 ? `Anotei ${noted.join(', ')}. ` : '';
  reply = `${prefix}${askFor(missing ?? 'municipio')}`;

  return {
    needsPatch: patch,
    reply,
    intent: 'ask_question',
    actions,
  };
}
