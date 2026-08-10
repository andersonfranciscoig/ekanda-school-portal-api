import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConciergeLlmResult,
  NeedsProfile,
  isNeedsReady,
  mergeNeeds,
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
    if (!this.isEnabled()) {
      return parseConciergeTurnDeterministic(message, needs);
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
      return parseConciergeTurnDeterministic(message, needs);
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const system = `És o Ekanda Concierge (Angola).
Não inventes escolas nem preços.
Pergunta um campo em falta de cada vez (ordem: município → classe → orçamento → transporte).
Classes: Creche, Pré-escolar, 1.ª–12.ª classe.
Orçamento em Kz (número).
"Perto de mim" sem localização → pedir município (não inventar).
Respostas curtas, claras, em português de Angola, sem markdown pesado.
Responde APENAS JSON válido com este formato:
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
      return this.normalizeLlmResult(parsed, needs);
    } catch (error) {
      this.logger.warn(
        `Ollama unavailable, using deterministic parser: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return parseConciergeTurnDeterministic(message, needs);
    }
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
    if (actions.compareTop || actions.softAdjust) {
      // keep as provided
    } else if (ready) {
      actions.shouldSearch = true;
    }

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
