/**
 * In-memory velocity limit for POST /api/checkout/init, keyed by client IP.
 * Added as a backstop against the card-testing pattern seen against
 * ShopUSA: a bot repeatedly walking checkout with disposable emails and
 * (likely stolen) card numbers. No new dependency -- this app runs as a
 * single Railway instance (railway.toml has no replica count), so an
 * in-process Map is correct today; if this service is ever scaled to
 * multiple instances, each instance would track its own counts and this
 * limit would become easier to evade -- revisit then (e.g. move counts to
 * the database or Redis).
 */

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS_PER_WINDOW = 6; // generous for a genuine shopper retrying a declined card

type Entry = { count: number; resetAt: number };

const attempts = new Map<string, Entry>();

/** Occasionally sweep expired entries so the map doesn't grow unbounded under distributed probing. */
function sweepExpired(now: number) {
  if (Math.random() > 0.01) return;
  for (const [ip, entry] of attempts) {
    if (entry.resetAt <= now) attempts.delete(ip);
  }
}

export function checkCheckoutRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  sweepExpired(now);

  const entry = attempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= MAX_ATTEMPTS_PER_WINDOW) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  return { allowed: true };
}

/** Railway terminates TLS and proxies to this app, setting x-forwarded-for to the real client IP (leftmost entry). */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
