export function normalizePage(page?: number, pageSize?: number) {
  const normalizedPage = Math.max(1, Number(page ?? 1) || 1);
  const normalizedPageSize = Math.min(50, Math.max(1, Number(pageSize ?? 20) || 20));
  return {
    page: normalizedPage,
    pageSize: normalizedPageSize,
    skip: (normalizedPage - 1) * normalizedPageSize,
  };
}

export function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

export function ageFromBirthDate(birthDate: Date, now = new Date()): number {
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return Math.max(0, age);
}

export function shortCode(prefix: string, id: string, length = 6): string {
  return `${prefix}${id.replace(/-/g, '').slice(0, length).toUpperCase()}`;
}
