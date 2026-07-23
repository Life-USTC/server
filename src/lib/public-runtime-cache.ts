import { writeCacheEventAnalytics } from "@/lib/metrics/analytics-engine";

type CacheEntry<T> = {
  expiresAt: number;
  value: Promise<T>;
};

const MAX_ENTRIES = 100;

const globalForPublicRuntimeCache = globalThis as typeof globalThis & {
  __lifeUstcPublicRuntimeCache?: Map<string, CacheEntry<unknown>>;
};

function cacheStore() {
  globalForPublicRuntimeCache.__lifeUstcPublicRuntimeCache ??= new Map();
  return globalForPublicRuntimeCache.__lifeUstcPublicRuntimeCache;
}

function pruneExpired(store: Map<string, CacheEntry<unknown>>, now: number) {
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) {
      store.delete(key);
    }
  }
}

function pruneOldest(store: Map<string, CacheEntry<unknown>>) {
  while (store.size > MAX_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (!oldestKey) return;
    store.delete(oldestKey);
  }
}

export function publicRuntimeCacheKey(
  prefix: string,
  searchParams: URLSearchParams,
) {
  const normalized = new URLSearchParams(searchParams);
  normalized.sort();
  return `${prefix}:${normalized.toString()}`;
}

export function cachedPublicRuntimeData<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const start = Date.now();
  const store = cacheStore();
  pruneExpired(store, now);

  const existing = store.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > now) {
    writeCacheEventAnalytics({
      event: "hit",
      ioObservedDurationMs: Date.now() - start,
      key,
      storeSize: store.size,
      ttlMs,
    });
    return existing.value;
  }

  writeCacheEventAnalytics({
    event: "miss",
    ioObservedDurationMs: Date.now() - start,
    key,
    storeSize: store.size,
    ttlMs,
  });
  const value = load()
    .then((result) => {
      writeCacheEventAnalytics({
        event: "load_success",
        ioObservedDurationMs: Date.now() - start,
        key,
        storeSize: store.size,
        ttlMs,
      });
      return result;
    })
    .catch((error) => {
      store.delete(key);
      writeCacheEventAnalytics({
        event: "load_error",
        ioObservedDurationMs: Date.now() - start,
        key,
        storeSize: store.size,
        ttlMs,
      });
      throw error;
    });
  store.set(key, { expiresAt: now + ttlMs, value });
  pruneOldest(store);
  return value;
}
