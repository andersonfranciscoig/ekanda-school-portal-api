import type { AgtNifLookupResponseContract } from './agt-nif-lookup.contract';
import type {
  NifLookupResult,
  NifLookupSnapshot,
  NifLookupVerdict,
} from '../../application/ports/nif-lookup.port';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function pickBooleanLike(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
    if (typeof value === 'string' && value.trim()) {
      const lower = value.trim().toLowerCase();
      if (['true', 'sim', 'yes', '1', 's'].includes(lower)) return 'Sim';
      if (['false', 'nao', 'não', 'no', '0', 'n'].includes(lower)) return 'Não';
      return value.trim();
    }
  }
  return null;
}

function unwrapPayload(raw: unknown): AgtNifLookupResponseContract {
  const root = asRecord(raw) as AgtNifLookupResponseContract | null;
  if (!root) return {};

  const nested =
    asRecord(root.data) ??
    asRecord(root.contribuinte) ??
    asRecord(root.result);

  if (nested) {
    return { ...root, ...(nested as AgtNifLookupResponseContract) };
  }
  return root;
}

function resolveVerdict(payload: AgtNifLookupResponseContract, nome: string | null): NifLookupVerdict {
  if (payload.found === false || payload.sucesso === false || payload.success === false) {
    return 'NOT_FOUND';
  }

  const estado = pickString(
    payload.estado,
    payload.state,
    payload.situacao,
    payload.situacaoCadastral,
  );

  if (!nome && !estado) return 'NOT_FOUND';

  if (!estado) return nome ? 'UNKNOWN' : 'NOT_FOUND';

  const normalized = estado
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

  if (
    normalized.includes('inactiv') ||
    normalized.includes('inativ') ||
    normalized.includes('cessad') ||
    normalized.includes('cancelad') ||
    normalized.includes('suspens')
  ) {
    return 'INACTIVE';
  }

  if (
    normalized.includes('activ') ||
    normalized.includes('ativ') ||
    normalized.includes('regular') ||
    normalized.includes('valido') ||
    normalized.includes('válido')
  ) {
    return 'ACTIVE';
  }

  return 'UNKNOWN';
}

/**
 * Converte a resposta bruta do fornecedor AGT no snapshot interno Ekanda.
 * Trocar aliases aqui quando a AGT publicar o contrato oficial.
 */
export function mapAgtNifLookupResponse(
  nif: string,
  raw: unknown,
  consultedAt = new Date().toISOString(),
): NifLookupResult {
  const payload = unwrapPayload(raw);

  const resolvedNif =
    pickString(payload.nif, payload.numero, payload.nifNumber) ?? nif.toUpperCase();

  const nome =
    pickString(payload.nome, payload.name, payload.denominacao, payload.nomeContribuinte) ?? '';

  const snapshot: NifLookupSnapshot = {
    nif: resolvedNif,
    nome,
    tipo: pickString(payload.tipo, payload.type, payload.tipoContribuinte),
    estado: pickString(
      payload.estado,
      payload.state,
      payload.situacao,
      payload.situacaoCadastral,
    ),
    inadimplente: pickBooleanLike(payload.inadimplente, payload.isDefaulter),
    regimeIva: pickString(payload.regimeIva, payload.vatRegime, payload.regimeIVA),
    residenciaFiscal: pickString(payload.residenciaFiscal, payload.taxResidence),
    consultedAt,
  };

  const verdict = resolveVerdict(payload, nome || null);
  return {
    found: verdict !== 'NOT_FOUND',
    verdict,
    snapshot,
  };
}
