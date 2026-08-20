import {
  MARKETPLACE_TEACHING_TYPE_LABELS,
  type MarketplaceSchoolCard,
} from '../../../marketplace/domain/marketplace-search.types';
import type { ResultsAnswerTopic } from '../concierge.types';

function locLabel(s: MarketplaceSchoolCard): string {
  const parts = [
    s.location?.neighborhood,
    s.location?.municipality,
    s.location?.province,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'localização a confirmar no perfil';
}

function priceLabel(s: MarketplaceSchoolCard): string {
  if (s.pricing.feesAreFree || s.pricing.tuitionFrom === 0) return 'gratuito';
  if (s.pricing.tuitionFrom == null) return 'preço sob consulta';
  return `a partir de ${s.pricing.tuitionFrom.toLocaleString('pt-AO')} Kz/mês`;
}

function isFree(s: MarketplaceSchoolCard): boolean {
  return Boolean(s.pricing.feesAreFree) || s.pricing.tuitionFrom === 0;
}

function hasService(s: MarketplaceSchoolCard, needle: string): boolean {
  const n = needle.toLowerCase();
  return s.services.some(
    (svc: { id: string; label: string }) =>
      svc.id.toLowerCase().includes(n) ||
      svc.label.toLowerCase().includes(n),
  );
}

function mapsUrl(s: MarketplaceSchoolCard): string {
  const q = [
    s.name,
    s.location?.neighborhood,
    s.location?.municipality,
    s.location?.province,
  ]
    .filter(Boolean)
    .join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function profileLink(s: MarketplaceSchoolCard): string {
  return `[Ver perfil de ${s.name}](/colegio/${s.slug})`;
}

function mapsLink(s: MarketplaceSchoolCard): string {
  return `[Abrir no mapa](${mapsUrl(s)})`;
}

function visitLink(s: MarketplaceSchoolCard, sessionId?: string): string {
  const q = sessionId ? `?sessao=${encodeURIComponent(sessionId)}` : '';
  return `[Agendar visita a ${s.name}](/concierge/visita/${s.slug}${q})`;
}

function resolveAboutTarget(
  message: string,
  schools: MarketplaceSchoolCard[],
): MarketplaceSchoolCard | null {
  const n = message
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (/\b(primeira|1[ªa]|1\.|melhor|top)\b/.test(n) && schools[0]) {
    return schools[0];
  }
  if (/\b(segunda|2[ªa]|2\.)\b/.test(n) && schools[1]) {
    return schools[1];
  }
  if (/\b(terceira|3[ªa]|3\.)\b/.test(n) && schools[2]) {
    return schools[2];
  }

  for (const s of schools) {
    const name = s.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const acronym = (s.acronym ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (name && n.includes(name)) return s;
    if (acronym.length >= 3 && n.includes(acronym)) return s;
    const tokens = name.split(/\s+/).filter((t: string) => t.length >= 4);
    if (tokens.some((t: string) => n.includes(t))) return s;
  }

  if (/\b(esta|essa|desta|dessa)\s+(escola|colegio|opcao|institui)/.test(n)) {
    return schools[0] ?? null;
  }
  return null;
}

/**
 * Resposta grounded nos cartões já mostrados — sem inventar dados.
 * Links em markdown: [rótulo](/path) ou [rótulo](https://...)
 */
export function answerFromResults(
  topic: ResultsAnswerTopic,
  schools: MarketplaceSchoolCard[],
  message = '',
  sessionId?: string,
): string {
  if (!schools.length) {
    return 'Ainda não tenho opções nesta conversa. Peça para listar escolas na sua zona e depois posso responder sobre elas.';
  }

  switch (topic) {
    case 'free': {
      const asked = resolveAboutTarget(message, schools);
      if (asked) {
        return isFree(asked)
          ? `Sim — o ${asked.name} está marcado como gratuito.\n${profileLink(asked)}`
          : `Não — o ${asked.name} tem mensalidade ${priceLabel(asked)}.\n${profileLink(asked)}`;
      }
      const free = schools.filter(isFree);
      if (!free.length) {
        return `Das ${schools.length} opções que mostrei, nenhuma está marcada como gratuita.\n${schools
          .map((s) => `• ${s.name}: ${priceLabel(s)} — ${profileLink(s)}`)
          .join('\n')}`;
      }
      if (free.length === 1) {
        const others = schools.filter((s) => !isFree(s));
        const otherBit = others.length
          ? ` As outras (${others.map((s) => s.name).join(', ')}) têm propinas.`
          : '';
        return `Das opções que mostrei, só o ${free[0]!.name} é gratuito.${otherBit}\n${profileLink(free[0]!)}\n${mapsLink(free[0]!)}`;
      }
      return `Das opções que mostrei, são gratuitas:\n${free
        .map((s) => `• ${s.name} — ${profileLink(s)}`)
        .join('\n')}`;
    }

    case 'location': {
      const target = resolveAboutTarget(message, schools) ?? schools[0]!;
      const onlyOne =
        schools.length === 1 || Boolean(resolveAboutTarget(message, schools));
      if (onlyOne || schools.length === 1) {
        return `O ${target.name} fica em ${locLabel(target)}.\n${mapsLink(target)}\n${profileLink(target)}`;
      }
      return schools
        .map((s) => `• ${s.name}: ${locLabel(s)}\n  ${mapsLink(s)} · ${profileLink(s)}`)
        .join('\n');
    }

    case 'distance': {
      const lines = schools.map((s) => {
        if (s.distanceKm != null && Number.isFinite(s.distanceKm)) {
          return `• ${s.name}: ${s.distanceKm.toFixed(1)} km de si — ${profileLink(s)}`;
        }
        return `• ${s.name}: distância indisponível (sem GPS ou coordenadas da escola) — ${profileLink(s)}`;
      });
      return `De acordo com a sua localização actual:\n${lines.join('\n')}`;
    }

    case 'transport': {
      const withT = schools.filter((s) => hasService(s, 'transporte'));
      if (!withT.length) {
        return `Nas opções actuais, nenhuma indica transporte escolar no perfil. Confirme no detalhe de cada escola.`;
      }
      return `Com transporte nas opções actuais:\n${withT
        .map((s) => `• ${s.name} — ${profileLink(s)}`)
        .join('\n')}`;
    }

    case 'cantina': {
      const withC = schools.filter((s) => hasService(s, 'cantina'));
      if (!withC.length) {
        return `Nas opções actuais, nenhuma indica cantina no perfil publicado.`;
      }
      return `Com cantina:\n${withC.map((s) => `• ${s.name} — ${profileLink(s)}`).join('\n')}`;
    }

    case 'cheapest': {
      const paid = schools
        .filter((s) => !isFree(s) && s.pricing.tuitionFrom != null)
        .sort(
          (a, b) => (a.pricing.tuitionFrom ?? 0) - (b.pricing.tuitionFrom ?? 0),
        );
      const free = schools.filter(isFree);
      if (free.length) {
        return `A opção mais económica das que mostrei é ${free[0]!.name} (gratuita).\n${profileLink(free[0]!)}\n${mapsLink(free[0]!)}`;
      }
      if (!paid.length) {
        return 'Ainda não tenho preços publicados suficientes para indicar a mais barata.';
      }
      return `Entre as opções com preço, a mais económica é ${paid[0]!.name} (${priceLabel(paid[0]!)}).\n${profileLink(paid[0]!)}`;
    }

    case 'closest': {
      const withKm = schools
        .filter((s) => s.distanceKm != null)
        .sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99));
      if (!withKm.length) {
        return 'Ainda não consigo ordenar por distância — permita a localização no browser ou confirme se as escolas têm coordenadas no mapa.';
      }
      const top = withKm[0]!;
      return `A mais próxima de si é ${top.name}, a cerca de ${top.distanceKm!.toFixed(1)} km (${locLabel(top)}).\n${mapsLink(top)}\n${profileLink(top)}`;
    }

    case 'rating': {
      const withR = [...schools].sort(
        (a, b) => b.rating.average - a.rating.average,
      );
      const top = withR[0]!;
      if (!top.rating.count) {
        return 'Ainda há poucas avaliações publicadas nestas opções.';
      }
      return `A melhor avaliação entre as opções é ${top.name} (${top.rating.average.toFixed(1)} · ${top.rating.count} avaliações).\n${profileLink(top)}`;
    }

    case 'vacancies': {
      const lines = schools.map(
        (s) =>
          `• ${s.name}: ${s.vacanciesTotal > 0 ? `${s.vacanciesTotal} vagas` : 'vagas a confirmar'} — ${profileLink(s)}`,
      );
      return `Vagas publicadas:\n${lines.join('\n')}`;
    }

    case 'services': {
      const lines = schools.map((s) => {
        const svc =
          s.services.map((x: { label: string }) => x.label).join(', ') ||
          'não listados';
        return `• ${s.name}: ${svc} — ${profileLink(s)}`;
      });
      return `Serviços publicados:\n${lines.join('\n')}`;
    }

    case 'about': {
      const target = resolveAboutTarget(message, schools) ?? schools[0]!;
      const tipo =
        MARKETPLACE_TEACHING_TYPE_LABELS[target.teachingType] ??
        target.teachingType;
      const km =
        target.distanceKm != null
          ? ` · ${target.distanceKm.toFixed(1)} km de si`
          : '';
      return `${target.name} (${tipo}) fica em ${locLabel(target)}${km}. Mensalidade: ${priceLabel(target)}. Compatibilidade com o seu perfil: ${target.compatibility.score}%.\n${profileLink(target)}\n${mapsLink(target)}\n${visitLink(target, sessionId)}`;
    }

    case 'compare': {
      const lines = schools.slice(0, 3).map((s, i) => {
        return `${i + 1}. ${s.name} — ${priceLabel(s)} · ${locLabel(s)} · ${s.compatibility.score}% compatível\n   ${profileLink(s)}`;
      });
      return `Resumo rápido das opções:\n${lines.join('\n')}`;
    }

    case 'how_to_apply': {
      const target = resolveAboutTarget(message, schools) ?? schools[0]!;
      return `Para candidatar-se ao ${target.name}, abra o perfil e use «Candidatar-se».\n[Iniciar candidatura](/colegio/${target.slug}/candidatura)\n${profileLink(target)}`;
    }

    case 'schedule_visit': {
      const target = resolveAboutTarget(message, schools) ?? schools[0]!;
      return `Perfeito — pode agendar uma visita ao ${target.name} pelo formulário da Ekanda.\n${visitLink(target, sessionId)}\n${profileLink(target)}`;
    }

    case 'generic':
    default: {
      return `Tenho ${schools.length} opção(ões) nesta conversa: ${schools
        .map((s) => s.name)
        .join(', ')}. Pode perguntar qual é gratuita, onde fica, qual está mais perto, ou agendar uma visita.\n${schools
        .slice(0, 3)
        .map((s) => profileLink(s))
        .join(' · ')}`;
    }
  }
}

export function detectResultsTopic(message: string): ResultsAnswerTopic | null {
  const n = message
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (!n) return null;

  if (
    /\b(agendar|marcar)\s+(uma\s+)?visita\b/.test(n) ||
    /\bquero\s+visitar\b/.test(n) ||
    /\bvisita\s+(ao|a\s+esta|nesta)\b/.test(n)
  ) {
    return 'schedule_visit';
  }

  if (
    /\bquantos?\s*(km|quilometros?)\b/.test(n) ||
    /\bdistancia\b/.test(n) ||
    /\bquao\s+longe\b/.test(n)
  ) {
    return 'distance';
  }

  if (
    /\b(onde\s+fica|localizacao|localiza[cç]ao|endereco|endere[cç]o|como\s+chegar|mapa)\b/.test(
      n,
    )
  ) {
    return 'location';
  }

  if (
    /\b(qual|quais|alguma|algumas)\b[\s\S]{0,40}\b(gratuita?|gratis|sem\s+custo|custo\s+zero)\b/.test(
      n,
    ) ||
    /\b(gratuita?|gratis)\b[\s\S]{0,30}\b(delas|dessas|estas|opcoes|escolas|colegios)\b/.test(
      n,
    ) ||
    /\bentre\s+(essas|estas|as)\b[\s\S]{0,40}\b(gratuita?|gratis)\b/.test(n) ||
    /\be\s+gratuita?\b/.test(n)
  ) {
    return 'free';
  }

  if (
    /\b(mais\s+barata?|mais\s+economica?|menor\s+preco|mais\s+em\s+conta)\b/.test(
      n,
    )
  ) {
    return 'cheapest';
  }

  if (
    /\b(mais\s+perta?|mais\s+proxima?|mais\s+perto|mais\s+perto\s+de\s+mim)\b/.test(
      n,
    )
  ) {
    return 'closest';
  }

  if (/\b(transporte|autocarro|bus)\b/.test(n) && /\b(qual|quais|tem|têm|ha|há)\b/.test(n)) {
    return 'transport';
  }
  if (/\btransporte\b/.test(n) && /\b(delas|dessas|estas|opcoes)\b/.test(n)) {
    return 'transport';
  }

  if (/\bcantina\b/.test(n)) return 'cantina';

  if (/\b(avaliacao|avalia[cç]ao|estrelas|nota)\b/.test(n)) return 'rating';

  if (/\b(vagas?|lotacao|capacidade)\b/.test(n)) return 'vacancies';

  if (
    /\b(servicos?|infraestrutura|o\s+que\s+tem|oferece)\b/.test(n) &&
    !/\bprocuro\b/.test(n)
  ) {
    return 'services';
  }

  if (
    /\b(compara(r)?|diferenca|diferen[cç]a|lado\s+a\s+lado)\b/.test(n) ||
    /\bqual\s+(a\s+)?melhor\b/.test(n)
  ) {
    return 'compare';
  }

  if (
    /\b(candidat|matricul|inscrev|como\s+me\s+inscrevo|como\s+candidatar)\b/.test(
      n,
    )
  ) {
    return 'how_to_apply';
  }

  if (
    /\b(fala[- ]?me|conta[- ]?me|diz[- ]?me|sobre|detalhe|mais\s+info|mais\s+informacao)\b/.test(
      n,
    ) ||
    /\b(primeira|segunda|terceira|esta|essa)\s+(escola|colegio|opcao)\b/.test(n)
  ) {
    return 'about';
  }

  // Referência genérica às opções já mostradas
  if (
    /\b(delas|dessas|estas\s+opcoes|nas\s+opcoes|das\s+que\s+(mostr|list))\b/.test(
      n,
    )
  ) {
    return 'generic';
  }

  return null;
}

/** Pergunta de follow-up sobre resultados vs novo pedido de procura. */
export function isResultsFollowUpContext(message: string): boolean {
  const n = message
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  // Novo pedido explícito de procura → não é follow-up
  if (
    /\b(procuro|quero\s+ver\s+outras|outras\s+opcoes|nova\s+procura|mudar\s+(a\s+)?zona|outra\s+zona|listar\s+todas)\b/.test(
      n,
    )
  ) {
    return false;
  }

  if (detectResultsTopic(message)) return true;

  return (
    /\b(qual|quais|onde|como|quanto|quantos|tem|têm|ha|há|e\s+a|e\s+o)\b/.test(
      n,
    ) &&
    /\b(essa|estas|delas|dessa|opcao|escola|colegio|gratuita|local|preco|km)\b/.test(
      n,
    )
  );
}

export function isOffTopicMessage(message: string): boolean {
  const n = message
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (n.length < 2) return false;

  // Cumprimentos e ajuda — no domínio
  if (
    /^(oi|ola|olá|bom\s+dia|boa\s+tarde|boa\s+noite|obrigad|thanks|ok|certo|sim|nao|não)\b/.test(
      n,
    )
  ) {
    return false;
  }

  // Perguntas típicas do Concierge (mesmo sem dizer "escola")
  if (detectResultsTopic(message)) return false;
  if (
    /\b(km|quilometro|distancia|localizacao|orcamento|mensalidade|propina|transporte|cantina|classe|turma|vaga|matricula|candidatura|visita|municipio|provincia|luanda|talatona)\b/.test(
      n,
    )
  ) {
    return false;
  }

  const schoolRelated =
    /\b(escola|colegio|col[eé]gio|turma|classe|matricul|candidat|visita|mensalidade|propina|ensino|educacao|educa[cç]ao|luanda|talatona|viana|belas|transporte|cantina|vaga|encarregado|filho|filha|crianca|ekanda|marketplace|institui)\b/.test(
      n,
    );

  if (schoolRelated) return false;

  // Temas tipicamente fora
  return (
    /\b(politica|futebol|receita|codigo|programar|bitcoin|namoro|piada|filme|musica)\b/.test(
      n,
    ) ||
    (n.length > 40 &&
      !/\b(procuro|quero|preciso|onde|qual|escola|colegio|km|distancia|local)\b/.test(
        n,
      ))
  );
}

export function offTopicReply(): string {
  return 'Estou aqui para ajudar a encontrar escolas e colégios em Angola — zona, classe, orçamento e o que importa para a família. Em que região ou nível de ensino quer começar?';
}
