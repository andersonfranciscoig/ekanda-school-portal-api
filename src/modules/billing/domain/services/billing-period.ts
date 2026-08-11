export function addBillingPeriod(start: Date, period: string): Date {
  const end = new Date(start.getTime());
  switch (period) {
    case 'QUARTERLY':
      end.setUTCMonth(end.getUTCMonth() + 3);
      break;
    case 'SEMIANNUAL':
      end.setUTCMonth(end.getUTCMonth() + 6);
      break;
    case 'YEARLY':
    case 'ONE_TIME':
      end.setUTCFullYear(end.getUTCFullYear() + 1);
      break;
    case 'MONTHLY':
    default:
      end.setUTCMonth(end.getUTCMonth() + 1);
      break;
  }
  return end;
}

export function normalizeExpressPhone(raw: string): string {
  return raw.replace(/[\s\-().+]/g, '').replace(/^00244/, '').replace(/^244/, '');
}

export function isValidExpressPhone(raw: string): boolean {
  return /^9\d{8}$/.test(normalizeExpressPhone(raw));
}
