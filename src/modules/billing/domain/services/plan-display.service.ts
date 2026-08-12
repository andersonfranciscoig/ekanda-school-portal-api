import { PlanCode } from '../entities/plan.entity';

/** Nome curto do plano de subscrição (UI). */
export function planShortLabel(code: string): string {
  switch (String(code).toUpperCase()) {
    case PlanCode.FREE:
      return 'Gratuito';
    case PlanCode.PRESENCE:
      return 'Presença';
    case PlanCode.MANAGEMENT:
      return 'Gestão';
    default:
      return code;
  }
}

/** Etiqueta completa do plano de subscrição. */
export function planTagline(code: string, fallbackName?: string): string {
  switch (String(code).toUpperCase()) {
    case PlanCode.FREE:
      return 'Plano Gratuito';
    case PlanCode.PRESENCE:
      return 'Plano Presença';
    case PlanCode.MANAGEMENT:
      return 'Plano Gestão';
    default:
      return fallbackName?.trim() || 'Plano';
  }
}

export const SUBSCRIPTION_PLAN_CODES = [
  PlanCode.FREE,
  PlanCode.PRESENCE,
  PlanCode.MANAGEMENT,
] as const;
