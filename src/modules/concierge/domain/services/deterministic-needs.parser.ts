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
  'ecosistema',
  'ecossistema',
  'ekanda',
  'sugestao',
  'sugestão',
  'sugestoes',
  'sugestões',
  'todos',
  'todas',
]);

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isFlexibleBudgetText(text: string): boolean {
  const flexible = normalize(text);
  // "qualquer classe" NÃO é orçamento
  if (/\bqualquer\s+classes?\b/.test(flexible) || /\bqualquer\s+umas?\s+(dessas\s+)?classes\b/.test(flexible)) {
    return false;
  }
  return (
    /\b(sem\s+prefer[eê]?ncia|sem\s+pereferencia|qualquer\s+valor|qualquer\s+pre[cç]o|indiferente|sem\s+limite)\b/.test(
      flexible,
    ) ||
    /\b(sem\s+preferencia|qualquer\s+orcamento)\b/.test(flexible) ||
    /\bn[aã]o\s+tenho\s+(um\s+)?pre[cç]o\s+maximo\b/.test(flexible) ||
    /\bn[aã]o\s+tenho\s+prefer[eê]ncia\b/.test(flexible) ||
    /\bqualquer\s+pre[cç]o\s+serve\b/.test(flexible)
  );
}

function extractPrice(text: string): number | null {
  const n = normalize(text);
  if (
    /\b(gratuita?|gratis|custo\s*zero|sem\s*custo|ensino\s*gr[aá]tis|100\s*%\s*gratuita?)\b/.test(
      n,
    )
  ) {
    return 0;
  }
  if (isFlexibleBudgetText(text)) {
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
  const n = normalize(text);
  // Flexível / multi-nível → tratado como browseWide no parse principal
  if (
    /\bqualquer\s+classes?\b/.test(n) ||
    /\bqualquer\s+umas?\s+(dessas\s+)?classes\b/.test(n) ||
    /\btodas\s+as\s+classes\b/.test(n) ||
    /\btodos\s+os\s+niveis\b/.test(n)
  ) {
    return null;
  }

  const dotted = text.match(/\b(\d{1,2})\.?\s*[ªa]\s*classe\b/i);
  if (dotted?.[1]) {
    return `${Number(dotted[1])}.ª classe`;
  }

  for (const pattern of CLASS_PATTERNS) {
    const m = text.match(pattern.re);
    if (!m) continue;
    if (pattern.value) return pattern.value;
    const num = m[1];
    if (num && /^\d+$/.test(num)) return `${num}.ª classe`;
  }
  return null;
}

/** Pedido explícito de listagem / ver todas as opções. */
function isBrowseListIntent(text: string): boolean {
  const n = normalize(text);
  const mentionsSchools =
    /\b(colegios?|escolas?|opcoes|institui[cç]oes)\b/.test(n);
  const listVerb =
    /\b(lista|listar|liste|mostre|mostra|mostrar|apresenta|apresentar|traga|traz|veja|ver)\b/.test(
      n,
    );
  return (
    (listVerb && mentionsSchools) ||
    /\btodos?\s+(os\s+)?(colegios?|escolas?)\b/.test(n) ||
    /\btodas?\s+(as\s+)?(escolas?|opcoes)\b/.test(n) ||
    /\becos+istema\s+ekanda\b/.test(n) ||
    /\bsugest[oõ]es?\s+de\s+todos\b/.test(n) ||
    /\blistar\s+(os\s+)?col[eé]gios\b/i.test(text)
  );
}

/** Pergunta sobre distância / km às opções já mostradas. */
function isDistanceQuestion(text: string): boolean {
  const n = normalize(text);
  return (
    /\bquantos?\s*(km|quilometros?)\b/.test(n) ||
    /\b(a\s+)?quantos?\s+(km|quilometros?)\b/.test(n) ||
    /\bdistancia\b/.test(n) ||
    /\bkm\s+de\s+distancia\b/.test(n) ||
    /\bquao\s+longe\b/.test(n) ||
    /\bproximo\s+de\s+(mim|minha\s+localizacao)\b/.test(n) ||
    /\bde\s+acordo\s+(com\s+)?(a\s+)?minha\s+localizacao\b/.test(n)
  );
}

/** Pedido de procura com zona + filtros claros, sem classe → listar opções. */
function isReadyToBrowseWithoutClass(
  text: string,
  patch: Partial<NeedsProfile>,
  current: NeedsProfile,
): boolean {
  const n = normalize(text);
  const looksLikeSearch =
    /\b(procuro|procura|quero|preciso|encontra|encontrar|mostrar|mostra|ver)\b/.test(
      n,
    );
  if (!looksLikeSearch) return false;

  const hasLocation =
    Boolean(patch.provincia?.trim() || patch.municipio?.trim()) ||
    Boolean(current.provincia?.trim() || current.municipio?.trim());
  if (!hasLocation) return false;

  const hasFilter =
    patch.precoMax != null ||
    current.precoMax != null ||
    Boolean(patch.tipoEnsino?.trim()) ||
    Boolean(current.tipoEnsino?.trim());

  const hasSpecificClass = Boolean(
    (patch.classe ?? '').trim() || (current.classe ?? '').trim(),
  );
  // Nesta mensagem ainda não há classe concreta
  const classInThisTurn = Boolean((patch.classe ?? '').trim());
  return hasFilter && !classInThisTurn && !hasSpecificClass;
}

/** Vários filhos / vários níveis / «depois avalio». */
function isMultiLevelOrDeferClassIntent(text: string): boolean {
  const n = normalize(text);
  return (
    /\bvarios\s+filhos\b/.test(n) ||
    /\bdesde\b[\s\S]{0,40}\bate\b/.test(n) ||
    (/\b(infancia|infantil|creche|pre[\s-]?escolar)\b/.test(n) &&
      /\b(medio|secundario|12|ii\s*ciclo)\b/.test(n)) ||
    /\bensino\s+de\s+infancia\b/.test(n) ||
    /\btodas?\s+as\s+(classes|niveis|opcoes)\b/.test(n) ||
    /\bdepois\s+(eu\s+)?(vou\s+)?avaliar\b/.test(n) ||
    /\b(apresentar|mostrar|ver)\s+todas?\b/.test(n) ||
    /\beu\s+vou\s+avaliar\b/.test(n)
  );
}

function applyBrowseWideDefaults(
  patch: Partial<NeedsProfile>,
  current: NeedsProfile,
  location: { provincia?: string; municipio?: string; clearMunicipio?: boolean },
) {
  patch.browseWide = true;
  patch.classe = '';
  if (!location.municipio || location.clearMunicipio) {
    if (patch.municipio === undefined) patch.municipio = '';
  }
  if (!patch.provincia) {
    patch.provincia = current.provincia || location.provincia || '';
  }
  if (patch.precoMax == null && current.precoMax == null) {
    patch.precoMax = 150000;
  }
  if (patch.transporte == null && current.transporte === null) {
    patch.transporte = false;
  }
}

function extractLocation(text: string): {
  municipio?: string;
  provincia?: string;
  clearMunicipio?: boolean;
} {
  const out: {
    municipio?: string;
    provincia?: string;
    clearMunicipio?: boolean;
  } = {};

  const found: Array<{ name: string; province: string }> = [];
  for (const item of KNOWN_MUNICIPIOS) {
    if (new RegExp(`\\b${item.name.replace(/\s+/g, '\\s+')}\\b`, 'i').test(text)) {
      found.push({
        name: item.name === 'Kilamba' ? 'Kilamba Kiaxi' : item.name,
        province: item.province,
      });
    }
  }

  const wantsBoth =
    /\b(pelos\s+dois|ambos|as\s+duas|os\s+dois|qualquer\s+(um\s+)?dos\s+dois)\b/i.test(
      text,
    );

  if (wantsBoth) {
    // Confirmação "pelos dois" mesmo sem repetir os nomes
    if (found.length >= 1) {
      out.provincia = found[0]!.province;
    }
    out.clearMunicipio = true;
    out.municipio = '';
    return out;
  }

  if (found.length >= 2 && /\bou\b/i.test(text)) {
    out.provincia = found[0]!.province;
    out.clearMunicipio = true;
    out.municipio = '';
    return out;
  }

  if (found.length === 1) {
    out.municipio = found[0]!.name;
    out.provincia = found[0]!.province;
    return out;
  }

  if (found.length >= 2) {
    // "Talatona ou Belas" sem escolha → pesquisar na província
    out.provincia = found[0]!.province;
    out.clearMunicipio = true;
    out.municipio = '';
    return out;
  }

  for (const province of KNOWN_PROVINCES) {
    if (new RegExp(`\\b${province.replace(/\s+/g, '\\s+')}\\b`, 'i').test(text)) {
      out.provincia = province;
      out.clearMunicipio = true;
      out.municipio = '';
      return out;
    }
  }

  // "perto de mim" / "aqui perto" → não inventar local
  if (/\bperto\s+de\s+mim\b|\baqui\s+perto\b|\bpr[oó]ximo\s+de\s+mim\b/i.test(text)) {
    return out;
  }

  // Evitar "no ecossistema" / "em Angola" genéricos — só padrões explícitos
  const near = text.match(
    /(?:estou\s+em|vivo\s+em|moro\s+em|munic[ií]pio\s+(?:de|em))\s+([A-Za-zÀ-ú][A-Za-zÀ-ú\s]{2,30})/i,
  );
  if (near?.[1]) {
    const candidate = near[1].trim().replace(/\s+/g, ' ');
    const first = candidate.split(/\s+/)[0] ?? candidate;
    if (!STOP_LOCATION.has(normalize(first)) && !STOP_LOCATION.has(normalize(candidate))) {
      if (
        !/classe|transporte|trasporte|col[eé]gio|escola|or[cç]amento|prefer|ecos+istema|ekanda/i.test(
          candidate,
        )
      ) {
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
    // Frases sobre preço/orçamento não respondem transporte
    if (/\b(pre[cç]o|orcamento|orçamento|kz|kwanza|mensalidade)\b/.test(t)) {
      return null;
    }
    const short = t.trim().split(/\s+/).length <= 6;
    if (!short && !/\btr[ae]nsporte\b/.test(t)) {
      return null;
    }
    if (/^(sim|yes|claro|preciso|quero|pode ser|ok)\b/.test(t) || t === 's') {
      return true;
    }
    if (
      /^(n[aã]o|nao|no|nunca|dispenso)(!|\.|,|$|\s)/.test(t) ||
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
      return 'Qual é o orçamento máximo mensal em Kz? (ou diga "qualquer valor" / "gratuita")';
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
  if (location.clearMunicipio) {
    patch.municipio = '';
    if (!location.provincia && current.provincia) {
      patch.provincia = current.provincia;
    }
  } else if (location.municipio) {
    patch.municipio = location.municipio;
  }
  if (location.provincia) patch.provincia = location.provincia;

  const classe = extractClasse(text);
  if (classe) patch.classe = classe;

  const price = extractPrice(text);
  if (price != null) patch.precoMax = price;

  // Orçamento flexível só com intenção clara de preço (não "qualquer classe")
  if (
    awaiting === 'precoMax' &&
    patch.precoMax == null &&
    isFlexibleBudgetText(text)
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

  if (/\bp[uú]blic[oa]s?\b/i.test(text)) patch.tipoEnsino = 'Pública';
  else if (/\bsemi[- ]?privado\b/i.test(text)) patch.tipoEnsino = 'Semi-privado';
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

  // "todos os colégios" / lista ampla / vários níveis / procura com filtros sem classe
  const browseAll =
    isBrowseListIntent(text) ||
    isMultiLevelOrDeferClassIntent(text) ||
    isReadyToBrowseWithoutClass(text, patch, current);

  if (browseAll) {
    applyBrowseWideDefaults(patch, current, location);
    softAdjust = softAdjust ?? 'more_options';
  }

  // «qualquer classe» / «todas as classes» sem listagem explícita
  if (
    !browseAll &&
    /\b(qualquer\s+classes?|todas\s+as\s+classes|todos\s+os\s+niveis)\b/i.test(
      normalize(text),
    )
  ) {
    applyBrowseWideDefaults(patch, current, location);
  }

  // Pergunta de distância → NÃO pesquisar de novo
  if (isDistanceQuestion(text)) {
    const zone =
      current.municipio?.trim() ||
      current.provincia?.trim() ||
      patch.municipio?.trim() ||
      patch.provincia?.trim();
    return {
      needsPatch: {},
      reply: zone
        ? `Com base na sua localização actual, a distância a cada instituição aparece no cartão (em km). Se vir «—», a escola ainda não tem coordenadas no mapa ou o browser não partilhou a sua localização.`
        : `A distância em km usa a sua localização actual e as coordenadas da instituição. Permita o GPS no browser e confirme que a escola tem localização no mapa.`,
      intent: 'clarify',
      actions: {
        shouldSearch: false,
        compareTop: null,
        softAdjust: null,
      },
    };
  }

  const merged = mergeNeeds(current, patch);
  const missing = nextMissingField(merged);
  const ready = isNeedsReady(merged);

  const noted: string[] = [];
  if (location.clearMunicipio && patch.provincia) {
    noted.push(`${patch.provincia} (vários municípios)`);
  } else if (patch.municipio) {
    noted.push(patch.municipio);
  } else if (patch.provincia) {
    noted.push(patch.provincia);
  }
  if (patch.classe) noted.push(patch.classe);
  if (patch.precoMax != null) {
    noted.push(
      patch.precoMax === 0
        ? 'ensino gratuito'
        : patch.precoMax >= 150000
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
    const again = mergeNeeds(current, patch);
    const canGo = isNeedsReady(again);
    actions.shouldSearch = canGo;
    const zone =
      again.municipio?.trim() ||
      again.provincia?.trim() ||
      '';
    const wide = Boolean(again.browseWide);
    if (browseAll && canGo) {
      return {
        needsPatch: patch,
        reply: zone
          ? `Perfeito. Vou listar instituições em ${zone}${
              wide ? ' (todos os níveis)' : ''
            }, priorizando as mais próximas de si — depois avalia com calma.`
          : 'Claro. Vou listar as instituições disponíveis, priorizando as mais próximas de si.',
        intent: 'ready_to_search',
        actions,
      };
    }
    if (canGo) {
      return {
        needsPatch: patch,
        reply: 'Vou ajustar a procura com base no seu pedido.',
        intent: 'soft_adjust',
        actions,
      };
    }
    // Browse pedido mas ainda falta localização
    if (browseAll && !zone) {
      return {
        needsPatch: patch,
        reply:
          'Com certeza. Em que província ou município quer ver as instituições?',
        intent: 'ask_question',
        actions,
      };
    }
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

  // Se já temos localização + browseWide mas ainda falta algo (raro), não insistir em classe
  if (patch.browseWide && missing === 'classe') {
    applyBrowseWideDefaults(patch, current, location);
    const again = mergeNeeds(current, patch);
    if (isNeedsReady(again)) {
      actions.shouldSearch = true;
      const zone =
        again.municipio?.trim() || again.provincia?.trim() || 'a sua zona';
      return {
        needsPatch: patch,
        reply: `Combinado — mostro as opções em ${zone} sem filtrar por uma só classe.`,
        intent: 'ready_to_search',
        actions,
      };
    }
  }

  const prefix = noted.length > 0 ? `Anotei ${noted.join(', ')}. ` : '';
  return {
    needsPatch: patch,
    reply: `${prefix}${askFor(missing ?? 'municipio')}`,
    intent: 'ask_question',
    actions,
  };
}
