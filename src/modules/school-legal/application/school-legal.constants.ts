export const LEGAL_SECTION_NIF = {
  id: 'nif',
  title: 'Validação fiscal (NIF)',
  description: 'Consulta e validação do NIF da instituição junto da AGT.',
  path: '/dashboard/juridico/nif',
} as const;

export const NIF_PATTERN = /^\d{9}[A-Z]{2}\d{3}$/i;

export const NIF_SUBMISSION_DEADLINE_DAYS = 10;
export const NIF_REMINDER_DAYS_REMAINING = 3;

export const NIF_DEADLINE_SUSPEND_REASON =
  'Prazo de 10 dias para submissão do NIF expirado sem cumprimento.';

export function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function computeNifDeadline(approvedAt: Date): Date {
  return addUtcDays(approvedAt, NIF_SUBMISSION_DEADLINE_DAYS);
}

export function daysRemainingUntil(deadline: Date, now = new Date()): number {
  return Math.ceil((deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

export function needsNifSubmission(status: string): boolean {
  return status === 'NOT_SUBMITTED' || status === 'REJECTED';
}

export function normalizeNif(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidNifFormat(nif: string): boolean {
  return NIF_PATTERN.test(normalizeNif(nif));
}

export function autoNifEnvForceDisabled(): boolean {
  const raw = process.env.SCHOOL_LEGAL_AUTO_NIF_ENABLED?.trim().toLowerCase();
  if (!raw) return false;
  return raw === '0' || raw === 'false' || raw === 'off' || raw === 'no';
}
