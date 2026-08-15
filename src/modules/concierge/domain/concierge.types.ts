export type NeedsProfile = {
  municipio: string;
  provincia: string;
  classe: string;
  precoMax: number | null;
  transporte: boolean | null;
  cantina: boolean | null;
  ingles: boolean | null;
  informatica: boolean | null;
  integral: boolean | null;
  tipoEnsino: string;
  turno: string;
  browseWide: boolean;
};

export type ConciergePhase =
  | 'greeting'
  | 'collecting'
  | 'processing'
  | 'results'
  | 'adjusting';

export type ConciergeMessageKind =
  | 'text'
  | 'processing'
  | 'results'
  | 'compare'
  | 'decision'
  | 'empty'
  | 'error';

export type ConciergeMessageRole = 'user' | 'assistant' | 'system';

export type ConciergeActions = {
  shouldSearch: boolean;
  compareTop: 2 | 3 | null;
  softAdjust: string | null;
};

export type ConciergeTurnIntent =
  | 'ask_question'
  | 'ready_to_search'
  | 'compare'
  | 'soft_adjust'
  | 'clarify';

export type ConciergeLlmResult = {
  needsPatch: Partial<NeedsProfile>;
  reply: string;
  intent: ConciergeTurnIntent;
  actions: ConciergeActions;
};

export const EMPTY_NEEDS: NeedsProfile = {
  municipio: '',
  provincia: '',
  classe: '',
  precoMax: null,
  transporte: null,
  cantina: null,
  ingles: null,
  informatica: null,
  integral: null,
  tipoEnsino: '',
  turno: '',
  browseWide: false,
};

export const WELCOME_MESSAGE =
  'Olá! Sou o assistente da Ekanda.\n\nEstou aqui para o ajudar a encontrar escolas e colégios — instituições públicas e privadas — que façam sentido para a sua família: zona, classe, orçamento e o que for importante para vocês.\n\nPode escrever à vontade, como se estivesse a falar comigo. Por exemplo: «Procuro escola pública gratuita em Luanda» ou «5.ª classe em Talatona, até 80 mil.»';

export const ALLOWED_VISIT_TIMES = [
  '09:00',
  '10:30',
  '14:00',
  '15:30',
  '17:00',
] as const;

export function mergeNeeds(
  current: NeedsProfile,
  patch: Partial<NeedsProfile>,
): NeedsProfile {
  return {
    ...current,
    ...Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ),
  } as NeedsProfile;
}

/** Campos mínimos para disparar search. precoMax=0 = ensino gratuito / custo zero. */
export function isNeedsReady(needs: NeedsProfile): boolean {
  const hasLocation =
    Boolean(needs.municipio?.trim()) || Boolean(needs.provincia?.trim());
  const hasClassOrBrowse =
    Boolean(needs.classe?.trim()) || Boolean(needs.browseWide);
  return (
    hasLocation &&
    hasClassOrBrowse &&
    needs.precoMax != null &&
    needs.precoMax >= 0 &&
    needs.transporte !== null
  );
}

export function nextMissingField(needs: NeedsProfile): string | null {
  const hasLocation =
    Boolean(needs.municipio?.trim()) || Boolean(needs.provincia?.trim());
  if (!hasLocation) return 'municipio';
  if (!needs.classe?.trim() && !needs.browseWide) return 'classe';
  if (needs.precoMax == null) return 'precoMax';
  if (needs.transporte === null) return 'transporte';
  return null;
}

export function buildSessionTitle(needs: NeedsProfile): string {
  const parts: string[] = [];
  if (needs.browseWide) parts.push('Procura ampla');
  else if (needs.classe) parts.push(`Colégio para ${needs.classe}`);
  if (needs.municipio) parts.push(needs.municipio);
  else if (needs.provincia) parts.push(needs.provincia);
  if (needs.precoMax != null) {
    parts.push(
      needs.precoMax === 0
        ? 'gratuito'
        : `até ${needs.precoMax.toLocaleString('pt-AO')} Kz`,
    );
  }
  return parts.length > 0 ? parts.join(' — ') : 'Nova procura';
}

export function needsToMarketplaceFilters(needs: NeedsProfile): {
  municipality?: string;
  province?: string;
  classLabel?: string;
  tuitionMax?: number;
  serviceIds: string[];
  fullDay?: boolean;
  teachingType?: string;
} {
  const serviceIds: string[] = [];
  if (needs.transporte === true) serviceIds.push('transporte');
  if (needs.cantina === true) serviceIds.push('cantina');
  if (needs.ingles === true) serviceIds.push('ingles');
  if (needs.informatica === true) serviceIds.push('informatica');

  let teachingType: string | undefined;
  const tipo = (needs.tipoEnsino ?? '').trim().toLowerCase();
  if (tipo.includes('públic') || tipo.includes('public')) teachingType = 'PUBLIC';
  else if (tipo.includes('semi')) teachingType = 'SEMI_PRIVATE';
  else if (tipo.includes('internacional')) teachingType = 'INTERNATIONAL';
  else if (tipo.includes('privado')) teachingType = 'PRIVATE';

  const municipality = (needs.municipio ?? '').trim();
  const province = (needs.provincia ?? '').trim();
  // «Luanda» como município costuma significar a província inteira
  const municipalityIsProvince =
    Boolean(municipality) &&
    Boolean(province) &&
    municipality.localeCompare(province, 'pt', { sensitivity: 'base' }) === 0;

  return {
    municipality:
      municipality && !municipalityIsProvince ? municipality : undefined,
    province: province || undefined,
    classLabel:
      needs.browseWide || !(needs.classe ?? '').trim()
        ? undefined
        : (needs.classe ?? '').trim(),
    tuitionMax: needs.precoMax ?? undefined,
    serviceIds,
    fullDay: needs.integral === true ? true : undefined,
    teachingType,
  };
}
