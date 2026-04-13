/**
 * In-memory TTL cache with stampede protection.
 * Designed for caching heavy aggregation endpoint responses.
 * Invalidates on data mutations via Socket.IO emitters and direct calls.
 */

const DEFAULT_TTL_MS = 30_000; // 30 seconds

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

let hits = 0;
let misses = 0;

// ── Core API ────────────────────────────────────────────────────

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.data as T;
}

export function cacheSet(key: string, data: unknown, ttlMs: number = DEFAULT_TTL_MS): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/**
 * Wrap an async function with cache. Main API for route handlers.
 *
 * - Cache hit: returns cached value immediately
 * - In-flight request for same key: shares the existing Promise (stampede protection)
 * - Cache miss: calls fn(), caches result on success, does NOT cache errors
 */
export async function cacheWrap<T>(key: string, fn: () => Promise<T>, ttlMs: number = DEFAULT_TTL_MS): Promise<T> {
  // Check cache first
  const cached = cacheGet<T>(key);
  if (cached !== undefined) {
    hits++;
    console.debug(`[cache] HIT ${key}`);
    return cached;
  }

  // Stampede protection: if another request is already fetching this key, share its Promise
  const existing = inflight.get(key);
  if (existing) {
    hits++;
    console.debug(`[cache] HIT (inflight) ${key}`);
    return existing as Promise<T>;
  }

  misses++;
  console.debug(`[cache] MISS ${key}`);

  // Execute the function and track the in-flight Promise
  const promise = fn()
    .then((result) => {
      cacheSet(key, result, ttlMs);
      inflight.delete(key);
      return result;
    })
    .catch((err) => {
      // Do NOT cache errors — remove from inflight and re-throw
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise);
  return promise;
}

// ── Invalidation ────────────────────────────────────────────────

/** Remove all cache entries whose key starts with the given pattern. */
export function invalidate(pattern: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(pattern)) store.delete(key);
  }
  for (const key of inflight.keys()) {
    if (key.startsWith(pattern)) inflight.delete(key);
  }
}

/** Clear the entire cache. */
export function invalidateAll(): void {
  store.clear();
  inflight.clear();
}

// ── Stats / Debug ───────────────────────────────────────────────

export function cacheStats(): { entries: number; inflight: number; hits: number; misses: number } {
  return { entries: store.size, inflight: inflight.size, hits, misses };
}

// ── Cleanup interval ────────────────────────────────────────────
// Sweep expired entries every 60s to prevent unbounded memory growth.

const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.expiresAt) store.delete(key);
  }
}, 60_000);

// Don't keep the process alive just for cache cleanup
cleanupInterval.unref();
