/**
 * Tiny in-memory sliding-window rate limiter (single server instance).
 * If you later run several instances, move this to Redis or a database table.
 */
const buckets = new Map<string, number[]>();

function prune(key: string, windowMs: number, now: number): number[] {
  const hits = (buckets.get(key) ?? []).filter(t => now - t < windowMs);
  if (hits.length) buckets.set(key, hits);
  else buckets.delete(key);
  return hits;
}

export interface LimitResult {
  ok: boolean;
  retryAfterSec: number;
}

/** Count one attempt. Returns ok=false (and does NOT count it) once the limit is reached. */
export function hit(key: string, limit: number, windowMs: number): LimitResult {
  const now = Date.now();
  const hits = prune(key, windowMs, now);
  if (hits.length >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000)) };
  }
  hits.push(now);
  buckets.set(key, hits);
  return { ok: true, retryAfterSec: 0 };
}

/** Check whether a key is currently blocked WITHOUT counting an attempt. */
export function peek(key: string, limit: number, windowMs: number): LimitResult {
  const now = Date.now();
  const hits = prune(key, windowMs, now);
  if (hits.length >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000)) };
  }
  return { ok: true, retryAfterSec: 0 };
}

export function reset(key: string): void {
  buckets.delete(key);
}

// Drop stale keys every 10 minutes so the map can't grow forever (1h is the longest window used).
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of buckets) {
    if (!hits.length || now - hits[hits.length - 1] > 60 * 60 * 1000) buckets.delete(key);
  }
}, 10 * 60 * 1000) as unknown as { unref?: () => void };
// don't let this timer keep the Node process alive on shutdown
cleanupTimer.unref?.();
