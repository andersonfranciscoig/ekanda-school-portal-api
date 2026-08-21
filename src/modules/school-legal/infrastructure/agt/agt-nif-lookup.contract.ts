export const AGT_NIF_LOOKUP_DEFAULT_PATH = '/api/v1/nif/{nif}';


export type AgtNifLookupResponseContract = {
  nif?: string;
  numero?: string;
  nifNumber?: string;

  nome?: string;
  name?: string;
  denominacao?: string;
  nomeContribuinte?: string;

  tipo?: string;
  type?: string;
  tipoContribuinte?: string;

  estado?: string;
  state?: string;
  situacao?: string;
  situacaoCadastral?: string;

  inadimplente?: string | boolean;
  isDefaulter?: boolean;

  regimeIva?: string;
  vatRegime?: string;
  regimeIVA?: string;

  residenciaFiscal?: string;
  taxResidence?: string;

  data?: AgtNifLookupResponseContract;
  contribuinte?: AgtNifLookupResponseContract;
  result?: AgtNifLookupResponseContract;

  sucesso?: boolean;
  success?: boolean;
  found?: boolean;
  error?: string | { message?: string };
  message?: string;
};

export type AgtNifLookupHttpConfig = {
  baseUrl: string;
  /** Path com `{nif}` (ex.: `/consultar-nif/{nif}`). */
  pathTemplate: string;
  method: 'GET' | 'POST';
  apiKey: string | null;
  authHeaderName: string;
  authScheme: string;
  timeoutMs: number;
};
