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
  { re: /\b(\d{1,2})[ªa.]?\s*classe\b/i, value: '' },
];

const KNOWN_MUNICIPIOS: Array<{ name: string; province: string }> = [
  { name: 'Talatona', province: 'Luanda' },
  { name: 'Belas', province: 'Luanda' },
  { name: 'Viana', province: 'Luanda' },
  { name: 'Cacuaco', province: 'Luanda' },
  { name: 'Cazenga', province: 'Luanda' },
  { name: 'Kilamba Kiaxi', province: 'Luanda' },
  { name: 'Kilamba', province: 'Luanda' },
  { name: 'Maianga', province: 'Luanda' },
  { name: 'Ingombota', province: 'Luanda' },
  { name: 'Sambizanga', province: 'Luanda' },
  { name: 'Rangel', province: 'Luanda' },
  { name: 'Samba', province: 'Luanda' },
  { name: 'Benfica', province: 'Luanda' },
  { name: 'Benguela', province: 'Benguela' },
  { name: 'Lobito', province: 'Benguela' },
  { name: 'Huambo', province: 'Huambo' },
  { name: 'Lubango', province: 'Huíla' },
];

const KNOWN_PROVINCES = [
  'Luanda',
  'Benguela',
  'Huambo',
  'Huíla',
  'Cabinda',
  'Bengo',
  'Bié',
  'Cuanza Norte',
  'Cuanza Sul',
  'Malange',
  'Moxico',
  'Namibe',
  'Uíge',
  'Zaire',
];

const STOP_LOCATION = new Set([
  'mim',
  'aqui',
  'casa',
  'trabalho',
  'escola',
  'colegio',
  'colégio',
  'classe',
  'transporte',
  'trasporte',
  'orcamento',
  'orçamento',
  'preferencia',
  'preferência',
  'pereferencia',
  'qualquer',
  'valor',
  'sim',
  'nao',
  'não',
]);

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function extractPrice(text: string): number | null {
  const flexible = normalize(text);
  if (
    /\b(sem\s+prefer[eê]?ncia|sem\s+pereferencia|qualquer\s+valor|indiferente|sem\s+limite|nao\s+tenho\s+preferencia|n[aã]o\s+tenho\s+prefer[eê]ncia)\b/.test(
      flexible,
    ) ||
    /\b(sem\s+preferencia|qualquer\s+orcamento)\b/.test(flexible)
  ) {
    return 150000;
  }

  const match =
    text.match(
      /(?:at[eé]|max(?:imo)?|or[cç]amento|mensalidade)?\s*(?:de\s*)?(\d{1,3}(?:[.\s]\d{3})+|\d{4,6})\s*(?:kz|kwanzas?)?/i,
    ) ?? text.match(/\b(\d{4,6})\s*(?:kz|kwanzas?)?\b/i);
  if (!match) return null;
  const raw = match[1]!.replace(/[.\s]/g, '');
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function extractClasse(text: string): string | null {
  for (const pattern of CLASS_PATTERNS) {
    const m = text.match(pattern.re);
    if (!m) continue;
    if (pattern.value) return pattern.value;
    const n = m[1];
    if (n && /^\d+$/.test(n)) return `${n}.ª classe`;
  }
  return null;
}

function extractLocation(text: string): {
  municipio?: string;
  provincia?: string;
} {
  const out: { municipio?: string; provincia?: string } = {};

  for (const item of KNOWN_MUNICIPIOS) {
    if (new RegExp(`\\b${item.name.replace(/\s+/g, '\\s+')}\\b`, 'i').test(text)) {
      out.municipio = item.name === 'Kilamba' ? 'Kilamba Kiaxi' : item.name;
      out.provincia = item.province;
      return out;
    }
  }

  for (const province of KNOWN_PROVINCES) {
    if (new RegExp(`\\b${province.replace(/\s+/g, '\\s+')}\\b`, 'i').test(text)) {
      out.provincia = province;
      // Sem município concreto — se estiver em Luanda, usar capital como default útil
      if (/luanda/i.test(province)) {
        out.municipio = 'Luanda';
      }
      return out;
    }
  }

  // "perto de mim" / "aqui perto" → não inventar local
  if (/\bperto\s+de\s+mim\b|\baqui\s+perto\b|\bpr[oó]ximo\s+de\s+mim\b/i.test(text)) {
    return out;
  }

  const near = text.match(
    /(?:estou\s+em|vivo\s+em|em|no|na|munic[ií]pio\s+de)\s+([A-Za-zÀ-ú][A-Za-zÀ-ú\s]{2,30})/i,
  );
  if (near?.[1]) {
    const candidate = near[1].trim().replace(/\s+/g, ' ');
    const first = candidate.split(/\s+/)[0] ?? candidate;
    if (!STOP_LOCATION.has(normalize(first)) && !STOP_LOCATION.has(normalize(candidate))) {
      if (!/classe|transporte|trasporte|col[eé]gio|escola|or[cç]amento|prefer/i.test(candidate)) {
        out.municipio = candidate;
      }
    }
  }

  return out;
}

/**
 * Interpreta sim/não/opcional, especialmente quando a pergunta activa é transporte.
 */
function extractTransporte(
  text: string,
  awaitingTransporte: boolean,
): boolean | null {
  const t = normalize(text);

  // Negativos primeiro
  if (
    /\bsem\s+tr[ae]nsporte\b/.test(t) ||
    /\bn[aã]o\s+(preciso|quero|necessito)\b/.test(t) ||
    /\bn[aã]o\s+preciso\s+(de\s+)?tr[ae]nsporte\b/.test(t) ||
    /\btr[ae]nsporte\s+(e\s+)?opcional\b/.test(t) ||
    /\bopcional\b/.test(t) ||
    /\bindiferente\b/.test(t) ||
    /\bn[aã]o\s+[eé]\s+obrigat[oó]rio\b/.test(t)
  ) {
    return false;
  }

  if (
    /\b(com\s+)?tr[ae]nsporte\b/.test(t) ||
    /\bpreciso\s+(de\s+)?tr[ae]nsporte\b/.test(t) ||
    /\bquero\s+tr[ae]nsporte\b/.test(t)
  ) {
    // "transporte opcional" already handled above
    if (/\bn[aã]o\b/.test(t)) return false;
    return true;
  }

  if (awaitingTransporte) {
    if (/^(sim|yes|claro|preciso|quero|pode ser|ok)\b/.test(t) || t === 's') {
      return true;
    }
    if (
      /^(n[aã]o|nao|no|nunca|dispenso)\b/.test(t) ||
      t === 'n' ||
      /\bn[aã]o\s+preciso\b/.test(t)
    ) {
      return false;
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
      return 'Qual é o orçamento máximo mensal em Kz? (ou diga "qualquer valor")';
    case 'transporte':
      return 'Precisa de transporte escolar? (sim / não / opcional)';
    default:
      return 'Pode partilhar mais detalhes da sua procura?';
  }
}

/**
 * Parser determinístico (fallback e rede de segurança do Ollama).
 */
export function parseConciergeTurnDeterministic(
  message: string,
  current: NeedsProfile,
): ConciergeLlmResult {
  const text = message.trim();
  const awaiting = nextMissingField(current);
  const patch: Partial<NeedsProfile> = {};

  const location = extractLocation(text);
  if (location.municipio) patch.municipio = location.municipio;
  if (location.provincia) patch.provincia = location.provincia;

  const classe = extractClasse(text);
  if (classe) patch.classe = classe;

  const price = extractPrice(text);
  if (price != null) patch.precoMax = price;

  // Se estamos à espera de orçamento e a mensagem é curta afirmativa sem número
  if (
    awaiting === 'precoMax' &&
    patch.precoMax == null &&
    /\b(pode\s+ser|tanto\s+faz|qualquer|indiferente)\b/i.test(text)
  ) {
    patch.precoMax = 150000;
  }

  const transporte = extractTransporte(text, awaiting === 'transporte');
  if (transporte !== null) patch.transporte = transporte;

  // Avançar / continuar quando já temos o essencial excepto transporte
  if (
    awaiting === 'transporte' &&
    patch.transporte == null &&
    /\b(vamos\s+avan|podemos\s+avan|avan[cç]?ar|vanacar|continuar|seguir)/i.test(
      normalize(text),
    )
  ) {
    patch.transporte = false;
  }

  const cantina = /\bcantina\b/i.test(text)
    ? !/\bsem\s+cantina\b/i.test(text)
    : null;
  if (cantina !== null) patch.cantina = cantina;

  if (/\bingl[eê]s\b/i.test(text)) {
    patch.ingles = !/\bsem\s+ingl[eê]s\b/i.test(text);
  }
  if (/\binform[aá]tica\b/i.test(text)) {
    patch.informatica = !/\bsem\s+inform[aá]tica\b/i.test(text);
  }
  if (/\b(integral|per[ií]odo\s+integral)\b/i.test(text)) {
    patch.integral = !/\bsem\s+integral\b/i.test(text);
  }

  if (/\bmanh[aã]\b/i.test(text)) patch.turno = 'Manhã';
  if (/\btarde\b/i.test(text)) patch.turno = 'Tarde';

  if (/\bsemi[- ]?privado\b/i.test(text)) patch.tipoEnsino = 'Semi-privado';
  else if (/\binternacional\b/i.test(text)) patch.tipoEnsino = 'Internacional';
  else if (/\bprivado\b/i.test(text)) patch.tipoEnsino = 'Privado';

  let compareTop: 2 | 3 | null = null;
  if (/\bcompara(r)?\s+(os\s+)?tr[eê]s\b/i.test(text) || /\btop\s*3\b/i.test(text)) {
    compareTop = 3;
  } else if (
    /\bcompara(r)?\s+(os\s+)?dois\b/i.test(text) ||
    /\btop\s*2\b/i.test(text)
  ) {
    compareTop = 2;
  }

  let softAdjust: string | null = null;
  if (/\bmais\s+barat[oa]s?\b|\bmais\s+econ[oó]mic[oa]s?\b/i.test(text)) {
    softAdjust = 'cheaper';
  } else if (/\bs[oó]\s+com\s+tr[ae]nsporte\b/i.test(text)) {
    softAdjust = 'only_transport';
  } else if (/\bsem\s+tr[ae]nsporte\b/i.test(text) && current.transporte === true) {
    softAdjust = 'no_transport';
  } else if (/\boutras\s+op[cç][oõ]es\b|\bmais\s+op[cç][oõ]es\b/i.test(text)) {
    softAdjust = 'more_options';
  }

  const merged = mergeNeeds(current, patch);
  const missing = nextMissingField(merged);
  const ready = isNeedsReady(merged);

  const noted: string[] = [];
  if (patch.municipio) noted.push(patch.municipio);
  else if (patch.provincia) noted.push(patch.provincia);
  if (patch.classe) noted.push(patch.classe);
  if (patch.precoMax != null) {
    noted.push(
      patch.precoMax >= 150000
        ? 'orçamento flexível'
        : `até ${patch.precoMax.toLocaleString('pt-AO')} Kz`,
    );
  }
  if (patch.transporte === true) noted.push('com transporte');
  if (patch.transporte === false) noted.push('transporte opcional/não');

  const actions: ConciergeActions = {
    shouldSearch: false,
    compareTop,
    softAdjust,
  };

  if (compareTop) {
    return {
      needsPatch: patch,
      reply: `Vou preparar a comparação dos ${compareTop} melhores resultados.`,
      intent: 'compare',
      actions,
    };
  }

  if (softAdjust) {
    actions.shouldSearch = true;
    return {
      needsPatch: patch,
      reply: 'Vou ajustar a procura com base no seu pedido.',
      intent: 'soft_adjust',
      actions,
    };
  }

  if (ready) {
    actions.shouldSearch = true;
    return {
      needsPatch: patch,
      reply:
        noted.length > 0
          ? `Perfeito. Anotei ${noted.join(', ')}. Vou procurar as melhores opções.`
          : 'Perfil completo. Vou procurar as melhores opções.',
      intent: 'ready_to_search',
      actions,
    };
  }

  const prefix = noted.length > 0 ? `Anotei ${noted.join(', ')}. ` : '';
  return {
    needsPatch: patch,
    reply: `${prefix}${askFor(missing ?? 'municipio')}`,
    intent: 'ask_question',
    actions,
  };
}
