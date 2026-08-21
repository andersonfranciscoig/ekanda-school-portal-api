import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  NifLookupPort,
  NifLookupResult,
} from '../../application/ports/nif-lookup.port';
import {
  AGT_NIF_LOOKUP_DEFAULT_PATH,
  type AgtNifLookupHttpConfig,
} from './agt-nif-lookup.contract';
import { mapAgtNifLookupResponse } from './map-agt-nif-lookup-response';

@Injectable()
export class HttpAgtNifLookupAdapter implements NifLookupPort {
  private readonly logger = new Logger(HttpAgtNifLookupAdapter.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.readConfig()?.baseUrl);
  }

  async lookup(nif: string): Promise<NifLookupResult> {
    const cfg = this.readConfig();
    if (!cfg) {
      throw new ServiceUnavailableException(
        'Consulta AGT não configurada. Defina AGT_NIF_LOOKUP_BASE_URL após o credenciamento.',
      );
    }

    const path = cfg.pathTemplate.replace(/\{nif\}/gi, encodeURIComponent(nif));
    const url = new URL(path.replace(/^\//, ''), cfg.baseUrl.endsWith('/') ? cfg.baseUrl : `${cfg.baseUrl}/`);

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (cfg.apiKey) {
      headers[cfg.authHeaderName] = cfg.authScheme
        ? `${cfg.authScheme} ${cfg.apiKey}`.trim()
        : cfg.apiKey;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

    try {
      const response = await fetch(url, {
        method: cfg.method,
        headers,
        signal: controller.signal,
        ...(cfg.method === 'POST'
          ? {
              body: JSON.stringify({ nif }),
              headers: { ...headers, 'Content-Type': 'application/json' },
            }
          : {}),
      });

      if (response.status === 404) {
        return mapAgtNifLookupResponse(nif, { found: false, sucesso: false });
      }

      const text = await response.text();
      let raw: unknown = {};
      if (text.trim()) {
        try {
          raw = JSON.parse(text) as unknown;
        } catch {
          this.logger.warn(`AGT NIF lookup: resposta não-JSON (${response.status})`);
          throw new ServiceUnavailableException(
            'A resposta da AGT não pôde ser interpretada. Verifique o contrato HTTP.',
          );
        }
      }

      if (!response.ok) {
        this.logger.warn(`AGT NIF lookup falhou: HTTP ${response.status}`);
        throw new ServiceUnavailableException(
          `Consulta AGT indisponível (HTTP ${response.status}). Tente mais tarde ou valide manualmente.`,
        );
      }

      return mapAgtNifLookupResponse(nif, raw);
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      const message = err instanceof Error ? err.message : 'erro desconhecido';
      this.logger.warn(`AGT NIF lookup error: ${message}`);
      throw new ServiceUnavailableException(
        'Não foi possível contactar o serviço de consulta AGT. Tente mais tarde ou valide manualmente.',
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private readConfig(): AgtNifLookupHttpConfig | null {
    const baseUrl = this.config.get<string>('AGT_NIF_LOOKUP_BASE_URL')?.trim();
    if (!baseUrl) return null;

    const methodRaw = this.config.get<string>('AGT_NIF_LOOKUP_METHOD')?.trim().toUpperCase();
    const method = methodRaw === 'POST' ? 'POST' : 'GET';
    const timeoutRaw = Number(this.config.get<string>('AGT_NIF_LOOKUP_TIMEOUT_MS') ?? '15000');

    return {
      baseUrl,
      pathTemplate:
        this.config.get<string>('AGT_NIF_LOOKUP_PATH')?.trim() || AGT_NIF_LOOKUP_DEFAULT_PATH,
      method,
      apiKey: this.config.get<string>('AGT_NIF_API_KEY')?.trim() || null,
      authHeaderName:
        this.config.get<string>('AGT_NIF_AUTH_HEADER')?.trim() || 'Authorization',
      authScheme: this.config.get<string>('AGT_NIF_AUTH_SCHEME')?.trim() ?? 'Bearer',
      timeoutMs: Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 15_000,
    };
  }
}
