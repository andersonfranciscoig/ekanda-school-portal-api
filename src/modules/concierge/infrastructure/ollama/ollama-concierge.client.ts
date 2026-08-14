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

export type ConciergeChatTurn = {
  role: 'user' | 'assistant';
  content: string;
};

/** Factos reais de um match — a IA só pode redigir a partir disto. */
export type GroundedMatchForExplain = {
  schoolId: string;
  name: string;
  score: number;
  factualReasons: string[];
  municipality: string | null;
  province: string | null;
  tuitionFrom: number | null;
  feesAreFree: boolean;
  services: string[];
  classes: string[];
  ratingAverage: number;
  vacanciesTotal: number;
  teachingType: string;
};

export type MatchExplanationResult = {
  explanations: Array<{ schoolId: string; text: string }>;
  compareSummary: string | null;
};

@Injectable()
export class OllamaConciergeClient {
  private readonly logger = new Logger(OllamaConciergeClient.name);

  constructor(private readonly config: ConfigService) {}

  async interpretTurn(
    message: string,
    needs: NeedsProfile,
    history: ConciergeChatTurn[] = [],
  ): Promise<ConciergeLlmResult> {
    const deterministic = parseConciergeTurnDeterministic(message, needs);

    if (!this.isEnabled()) {
      return deterministic;
    }

    const baseUrl = this.config
      .get<string>('OLLAMA_BASE_URL')
      ?.trim()
      .replace(/\/$/, '');
    const model =
      this.config.get<string>('OLLAMA_MODEL')?.trim() || 'gpt-oss:120b';
    const apiKey = this.getApiKey();
    const timeoutMs = Number(this.config.get('OLLAMA_TIMEOUT_MS') ?? 90000);
    const temperature = this.readNumber('OLLAMA_TEMPERATURE', 0.75);
    const topP = this.readNumber('OLLAMA_TOP_P', 0.9);

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
      const recentHistory = history
        .filter((m) => m.content.trim().length > 0)
        .slice(-10);

      const system = this.buildSystemPrompt(awaiting);

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
          options: {
            temperature,
            top_p: topP,
          },
          messages: [
            { role: 'system', content: system },
            ...recentHistory.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            {
              role: 'user',
              content: JSON.stringify({
                currentNeeds: needs,
                awaitingField: awaiting,
                message,
                readyHint: isNeedsReady(needs),
                instruction:
                  'Extrai o que o utilizador disse, actualiza needsPatch e responde de forma natural em reply.',
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
      const parsed = this.parseJsonObject(content);
      return this.mergeWithDeterministic(
        this.normalizeLlmResult(parsed as ConciergeLlmResult, needs),
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
   * Explica matches com IA grounded: score/% e factos vêm do marketplace;
   * a IA só redige texto — nunca inventa preços, serviços ou nomes.
   */
  async explainMatches(
    needs: NeedsProfile,
    matches: GroundedMatchForExplain[],
  ): Promise<MatchExplanationResult> {
    const empty: MatchExplanationResult = {
      explanations: [],
      compareSummary: null,
    };
    if (!matches.length || !this.isEnabled()) return empty;

    const baseUrl = this.config
      .get<string>('OLLAMA_BASE_URL')
      ?.trim()
      .replace(/\/$/, '');
    if (!baseUrl) return empty;

    const model =
      this.config.get<string>('OLLAMA_MODEL')?.trim() || 'gpt-oss:120b';
    const apiKey = this.getApiKey();
    const timeoutMs = Number(this.config.get('OLLAMA_TIMEOUT_MS') ?? 90000);
    const allowedIds = new Set(matches.map((m) => m.schoolId));

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model,
          stream: false,
          format: 'json',
          options: { temperature: 0.4, top_p: 0.85 },
          messages: [
            { role: 'system', content: this.buildExplainSystemPrompt() },
            {
              role: 'user',
              content: JSON.stringify({
                familyNeeds: needs,
                matches,
                instruction:
                  'Para cada escola, escreve 1–2 frases a explicar o match usando APENAS os factos e motivos fornecidos. Não inventes dados. Inclui compareSummary se houver 2+ escolas.',
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
      const raw = this.parseJsonObject(payload.message?.content ?? '') as {
        explanations?: Array<{ schoolId?: string; text?: string }>;
        compareSummary?: string | null;
      };

      const explanations = (raw.explanations ?? [])
        .filter(
          (e) =>
            typeof e.schoolId === 'string' &&
            allowedIds.has(e.schoolId) &&
            typeof e.text === 'string' &&
            e.text.trim().length > 0,
        )
        .map((e) => ({
          schoolId: e.schoolId!,
          text: e.text!.trim().slice(0, 500),
        }));

      const compareSummary =
        typeof raw.compareSummary === 'string' && raw.compareSummary.trim()
          ? raw.compareSummary.trim().slice(0, 800)
          : null;

      return { explanations, compareSummary };
    } catch (error) {
      this.logger.warn(
        `Ollama explainMatches failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return empty;
    }
  }

  private buildExplainSystemPrompt(): string {
    return `És o Ekanda Concierge — redactor de explicações de match (Angola).

## Regras absolutas (dados 100% reais)
- Os números de compatibilidade (score), preços, serviços, classes, localização e avaliações JÁ estão nos factos.
- NUNCA inventes preços, distâncias, serviços, vagas, avaliações ou nomes de escolas.
- NUNCA alters o score. Podes citar a % se estiver nos factos.
- Só podes mencionar o que aparece em factualReasons ou nos campos facts de cada match.
- Se um dado não estiver presente, não o mentions.

## Estilo
- Português de Angola, claro e caloroso.
- 1–2 frases por escola em "text".
- compareSummary (opcional): 2–3 frases a comparar as opções com base nos factos.

## Formato
Responde APENAS JSON:
{
  "explanations": [{ "schoolId": string, "text": string }],
  "compareSummary": string|null
}`;
  }

  private buildSystemPrompt(awaiting: string | null): string {
    return `És o Ekanda Concierge — assistente de conversa da plataforma Ekanda (Angola).

## Propósito (não saias disto)
Ajudas encarregados de educação a encontrar escolas e colégios (instituições públicas e privadas) que correspondam às necessidades da família.
Não és um chatbot genérico. Se o utilizador falar de algo fora deste propósito (política, código, piadas longas, outros temas), responde com empatia numa frase e redirecciona para a procura de escola ou colégio.

## Tom de conversa
- Português de Angola, natural e caloroso — como um consultor humano, não um formulário.
- Frases fluidas, variação de linguagem; evita repetir sempre a mesma pergunta-padrão.
- Podes reconhecer o que a pessoa já contou ("Perfeito, então em Talatona…") antes de avançar.
- 1–3 frases curtas na reply. Sem listas longas, sem markdown pesado, sem inventar nomes de escolas ou preços.
- Nunca digas que és um modelo de IA / Ollama / Nemotron.

## Recolha de necessidades
Campos mínimos: município/província → classe → orçamento (precoMax em Kz) → transporte (sim/não).
Opcionais: cantina, inglês, informática, integral, tipoEnsino, turno.
- Se a pessoa der vários dados de uma vez, extrai TODOS para needsPatch e só pergunta o que ainda falta.
- Quando faltar algo, prioriza o campo: ${awaiting ?? 'nenhum (já podes pesquisar)'}.
- Localização: "perto do Talatona" / "em Talatona" → municipio=Talatona, provincia=Luanda.
  "estou em Luanda" sem município → provincia=Luanda e pergunta o município.
  "perto de mim" NÃO é município. Nunca grave "mim", "preferência", "qualquer", "aqui" como município.
- Orçamento: só preencher precoMax se houver número claro OU se disser explicitamente
  "qualquer valor" / "sem preferência" / "indiferente" → precoMax=150000.
  "gratuita" / "gratuito" / "custo zero" / "sem custo" / "ensino grátis" → precoMax=0 (válido).
  Frases como "orçamento apertado", "barato", "económico" NÃO são número — não inventes precoMax; pergunta um valor máximo em Kz com empatia.
- tipoEnsino: "pública" / "escola pública" → "Pública"; "privada" / "colégio privado" → "Privado"; semi-privado; internacional.
- Transporte: sim/preciso → true; não/nao/opcional/não preciso/indiferente → false.
- Classes: normalizar para Creche, Pré-escolar, 1.ª classe … 12.ª classe (ex.: "5ª" → "5.ª classe").
- Quando tiveres o mínimo completo, intent=ready_to_search e actions.shouldSearch=true, com uma reply animada a confirmar que vais procurar.

## Formato de saída
Responde APENAS JSON válido (sem texto fora do JSON):
{
  "needsPatch": { "municipio"?: string, "provincia"?: string, "classe"?: string, "precoMax"?: number|null, "transporte"?: boolean|null, "cantina"?: boolean|null, "ingles"?: boolean|null, "informatica"?: boolean|null, "integral"?: boolean|null, "tipoEnsino"?: string, "turno"?: string },
  "reply": string,
  "intent": "ask_question"|"ready_to_search"|"compare"|"soft_adjust"|"clarify",
  "actions": { "shouldSearch": boolean, "compareTop": 2|3|null, "softAdjust": "cheaper"|"only_transport"|"no_transport"|null }
}`;
  }

  /**
   * Extracções determinísticas ganham nos campos estruturados;
   * a reply do LLM prevalece para soar natural.
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

    const llmReply =
      typeof llm.reply === 'string' && llm.reply.trim()
        ? llm.reply.trim()
        : '';
    const reply = llmReply || det.reply;

    return {
      needsPatch: patch,
      reply,
      intent: ready
        ? 'ready_to_search'
        : (llm.intent ?? det.intent ?? 'ask_question'),
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

  private readNumber(key: string, fallback: number): number {
    const raw = this.config.get<string>(key);
    if (raw == null || raw === '') return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  private parseJsonObject(content: string): Record<string, unknown> {
    const trimmed = content.trim();
    try {
      return JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      const start = trimmed.indexOf('{');
      const end = trimmed.lastIndexOf('}');
      if (start >= 0 && end > start) {
        return JSON.parse(trimmed.slice(start, end + 1)) as Record<
          string,
          unknown
        >;
      }
      throw new Error('LLM response was not valid JSON');
    }
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
