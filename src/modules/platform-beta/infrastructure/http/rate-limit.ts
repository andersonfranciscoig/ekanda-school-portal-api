/** Rate limit simples em memória (IP + chave). Suficiente para MVP. */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function assertRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit) {
    const err = new Error('RATE_LIMIT');
    (err as Error & { statusCode: number }).statusCode = 429;
    throw err;
  }
  current.count += 1;
}
