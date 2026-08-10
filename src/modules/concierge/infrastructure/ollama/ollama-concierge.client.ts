import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConciergeLlmResult,
  NeedsProfile,
  isNeedsReady,
  mergeNeeds,
  nextMissingField,
} from '../../domain/concierge.types';
import { parseConciergeTurnDeterministic } from '../../domain/services/deterministic-needs.parser';

@Injectable()
export class OllamaConciergeClient {
  private readonly logger = new Logger(OllamaConciergeClient.name);

  constructor(private readonly config: ConfigService) {}

  async interpretTurn(
    message: string,
    needs: NeedsProfile,
  ): Promise<ConciergeLlmResult> {
    const deterministic = parseConciergeTurnDeterministic(message, needs);

    if (!this.isEnabled()) {
      return deterministic;
    }

    const baseUrl = this.config
      .get<string>('OLLAMA_BASE_URL')
      ?.trim()
      .replace(/\/$/, '');
    const model = this.config.get<string>('OLLAMA_MODEL')?.trim() || 'llama3.2';
    const apiKey = this.getApiKey();
    const timeoutMs = Number(this.config.get('OLLAMA_TIMEOUT_MS') ?? 60000);

    if (!baseUrl) {
      this.logger.warn(
        'OLLAMA_ENABLED=true but OLLAMA_BASE_URL is empty; using deterministic parser',
      );
      return deterministic;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const awaiting = nextMissingField(needs);

      const system = `És o Ekanda Concierge (Angola).
Não inventes escolas nem preços.
Pergunta UM campo em falta de cada vez (ordem: município → classe → orçamento → transporte).
Campo actualmente em falta: ${awaiting ?? 'nenhum'}.

Regras de extracção:
- "perto de mim" NÃO é município. Se disser "estou em Luanda", use provincia=Luanda e municipio=Luanda (ou peça município).
- Nunca grave palavras como "mim", "preferência", "qualquer" como município.
- Orçamento: extrair número em Kz. "qualquer valor" / "sem preferência" / "indiferente" → precoMax=150000.
- Transporte: "sim"/"não"/"nao"/"opcional"/"não preciso"/"indiferente" quando a pergunta é transporte.
  - opcional / não preciso / indiferente → transporte=false
  - sim / preciso → transporte=true
- Classes: Creche, Pré-escolar, 1.ª–12.ª classe.
Respostas curtas em português de Angola.
Responde APENAS JSON válido:
{
  "needsPatch": { "municipio"?: string, "provincia"?: string, "classe"?: string, "precoMax"?: number|null, "transporte"?: boolean|null, "cantina"?: boolean|null, "ingles"?: boolean|null, "informatica"?: boolean|null, "integral"?: boolean|null, "tipoEnsino"?: string, "turno"?: string },
  "reply": string,
  "intent": "ask_question"|"ready_to_search"|"compare"|"soft_adjust"|"clarify",
  "actions": { "shouldSearch": boolean, "compareTop": 2|3|null, "softAdjust": string|null }
}`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model,
          stream: false,
          format: 'json',
          messages: [
            { role: 'system', content: system },
            {
              role: 'user',
              content: JSON.stringify({
                currentNeeds: needs,
                awaitingField: awaiting,
                message,
                readyHint: isNeedsReady(needs),
              }),
            },
          ],
        }),
      });
      clearTimeout(timer);

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(
          `Ollama HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
        );
      }

      const payload = (await response.json()) as {
        message?: { content?: string };
      };
      const content = payload.message?.content ?? '';
      const parsed = JSON.parse(content) as ConciergeLlmResult;
      return this.mergeWithDeterministic(
        this.normalizeLlmResult(parsed, needs),
        deterministic,
        needs,
      );
    } catch (error) {
      this.logger.warn(
        `Ollama unavailable, using deterministic parser: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return deterministic;
    }
  }

  /**
   * Extracções determinísticas ganham nos campos estruturados;
   * o LLM pode melhorar a reply se o perfil ainda estiver incompleto.
   */
  private mergeWithDeterministic(
    llm: ConciergeLlmResult,
    det: ConciergeLlmResult,
    current: NeedsProfile,
  ): ConciergeLlmResult {
    const patch: Partial<NeedsProfile> = {
      ...llm.needsPatch,
      ...det.needsPatch,
    };

    // Evitar lixo do LLM em município
    if (
      patch.municipio &&
      /^(mim|prefer[eê]ncia|pereferencia|qualquer|valor|aqui)$/i.test(
        patch.municipio.trim(),
      )
    ) {
      delete patch.municipio;
    }

    const merged = mergeNeeds(current, patch);
    const ready = isNeedsReady(merged);
    const shouldSearch =
      Boolean(det.actions.shouldSearch) ||
      Boolean(llm.actions?.shouldSearch) ||
      ready;

    const reply =
      det.actions.shouldSearch || det.intent === 'ready_to_search'
        ? det.reply
        : typeof llm.reply === 'string' && llm.reply.trim()
          ? llm.reply.trim()
          : det.reply;

    return {
      needsPatch: patch,
      reply,
      intent: ready
        ? 'ready_to_search'
        : (det.intent ?? llm.intent ?? 'ask_question'),
      actions: {
        shouldSearch,
        compareTop: det.actions.compareTop ?? llm.actions?.compareTop ?? null,
        softAdjust: det.actions.softAdjust ?? llm.actions?.softAdjust ?? null,
      },
    };
  }

  private isEnabled(): boolean {
    const raw = this.config.get<string>('OLLAMA_ENABLED');
    if (raw == null || raw === '') return false;
    return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
  }

  private getApiKey(): string | null {
    const raw = this.config.get<string>('OLLAMA_API_KEY');
    if (!raw?.trim()) return null;
    return raw.trim().replace(/^["']|["']$/g, '');
  }

  private normalizeLlmResult(
    raw: ConciergeLlmResult,
    current: NeedsProfile,
  ): ConciergeLlmResult {
    const patch = raw.needsPatch ?? {};
    const merged = mergeNeeds(current, patch);
    const ready = isNeedsReady(merged);
    const actions = {
      shouldSearch: Boolean(raw.actions?.shouldSearch) || ready,
      compareTop:
        raw.actions?.compareTop === 2 || raw.actions?.compareTop === 3
          ? raw.actions.compareTop
          : null,
      softAdjust: raw.actions?.softAdjust ?? null,
    };

    return {
      needsPatch: patch,
      reply:
        typeof raw.reply === 'string' && raw.reply.trim()
          ? raw.reply.trim()
          : parseConciergeTurnDeterministic('', merged).reply,
      intent: raw.intent ?? (ready ? 'ready_to_search' : 'ask_question'),
      actions,
    };
  }
}
