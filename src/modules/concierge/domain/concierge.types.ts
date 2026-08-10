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
};

export const WELCOME_MESSAGE =
  'Olá 👋\nSou o Ekanda Concierge.\n\nVou ajudá-lo a encontrar colégios que correspondam às suas necessidades.\n\nPode começar por me contar o que procura.';

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

/** Campos mínimos para disparar search. */
export function isNeedsReady(needs: NeedsProfile): boolean {
  return (
    Boolean(needs.municipio?.trim()) &&
    Boolean(needs.classe?.trim()) &&
    needs.precoMax != null &&
    needs.precoMax > 0 &&
    needs.transporte !== null
  );
}

export function nextMissingField(needs: NeedsProfile): string | null {
  if (!needs.municipio?.trim()) return 'municipio';
  if (!needs.classe?.trim()) return 'classe';
  if (needs.precoMax == null || needs.precoMax <= 0) return 'precoMax';
  if (needs.transporte === null) return 'transporte';
  return null;
}

export function buildSessionTitle(needs: NeedsProfile): string {
  const parts: string[] = [];
  if (needs.classe) parts.push(`Colégio para ${needs.classe}`);
  if (needs.municipio) parts.push(needs.municipio);
  if (needs.precoMax != null) {
    parts.push(`até ${needs.precoMax.toLocaleString('pt-AO')} Kz`);
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
  const tipo = needs.tipoEnsino.trim().toLowerCase();
  if (tipo.includes('semi')) teachingType = 'SEMI_PRIVATE';
  else if (tipo.includes('internacional')) teachingType = 'INTERNATIONAL';
  else if (tipo.includes('privado')) teachingType = 'PRIVATE';

  return {
    municipality: needs.municipio.trim() || undefined,
    province: needs.provincia.trim() || undefined,
    classLabel: needs.classe.trim() || undefined,
    tuitionMax: needs.precoMax ?? undefined,
    serviceIds,
    fullDay: needs.integral === true ? true : undefined,
    teachingType,
  };
}
