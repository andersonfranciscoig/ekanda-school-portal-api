export const NIF_LOOKUP_PORT = Symbol('NIF_LOOKUP_PORT');

export type NifLookupVerdict = 'ACTIVE' | 'INACTIVE' | 'NOT_FOUND' | 'UNKNOWN';

export type NifLookupSnapshot = {
  nif: string;
  nome: string;
  tipo: string | null;
  estado: string | null;
  inadimplente: string | null;
  regimeIva: string | null;
  residenciaFiscal: string | null;
  consultedAt: string;
};

export type NifLookupResult = {
  found: boolean;
  verdict: NifLookupVerdict;
  snapshot: NifLookupSnapshot;
};

export interface NifLookupPort {
  isConfigured(): boolean;
  lookup(nif: string): Promise<NifLookupResult>;
}
