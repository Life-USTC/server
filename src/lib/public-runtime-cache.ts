import type { AppLocale } from "@/i18n/config";
import {
  type CloudflareCache,
  getCloudflareNamedCache,
  getCloudflareRuntimeTaskScheduler,
} from "@/lib/adapters/cloudflare-runtime";
import {
  type PublicRuntimeCacheAnalyticsNamespace,
  type PublicRuntimeCacheAnalyticsReason,
  writeCacheEventAnalytics,
} from "@/lib/metrics/analytics-engine";

type CacheEntry<T> = {
  expiresAt: number;
  value: Promise<T>;
};

type PublicRuntimeCacheOptions<T> = {
  coloCacheKey?: string;
  shouldCacheResult?: (result: T) => boolean;
  validateColoCacheResult?: (result: unknown) => boolean;
};

type ColoCacheEnvelope = {
  expiresAt: number;
  schema: string;
  value: unknown;
};

type ColoCacheRead<T> =
  | { expiresAt: number; hit: true; value: T }
  | { cache?: CloudflareCache; hit: false; request?: Request };

type ColoCacheEvent =
  | "colo_hit"
  | "colo_miss"
  | "colo_read_error"
  | "colo_write_error"
  | "colo_write_complete"
  | "colo_write_skip";

const MAX_ENTRIES = 100;
const PUBLIC_DETAIL_COLO_CACHE_NAME = "life-ustc-public-detail-core-v1";
const PUBLIC_DETAIL_COLO_CACHE_SCHEMA = "catalog-detail-core-v1";
const PUBLIC_DETAIL_COLO_CACHE_PATH =
  "/_life-ustc-internal-cache/catalog-detail-core/v1";
const publicDetailColoCacheShapes = {
  course: "core-without-sections",
  section: "core-without-exams-schedules-related",
  teacher: "core-without-sections",
} as const;

export type PublicDetailColoCacheKind =
  keyof typeof publicDetailColoCacheShapes;

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

function deleteCurrentEntry(
  store: Map<string, CacheEntry<unknown>>,
  key: string,
  value: Promise<unknown>,
) {
  if (store.get(key)?.value === value) {
    store.delete(key);
  }
}

function shortenCurrentEntryExpiry(
  store: Map<string, CacheEntry<unknown>>,
  key: string,
  value: Promise<unknown>,
  expiresAt: number,
) {
  const entry = store.get(key);
  if (entry?.value === value) {
    entry.expiresAt = Math.min(entry.expiresAt, expiresAt);
  }
}

function writeColoCacheEvent(
  event: ColoCacheEvent,
  namespace: PublicRuntimeCacheAnalyticsNamespace,
  start: number,
  storeSize: number,
  ttlMs: number,
  reason: PublicRuntimeCacheAnalyticsReason = "none",
) {
  writeCacheEventAnalytics({
    event,
    ioObservedDurationMs: Date.now() - start,
    namespace,
    reason,
    storeSize,
    ttlMs,
  });
}

function validColoCacheEnvelope(
  value: unknown,
  now: number,
  ttlMs: number,
): value is ColoCacheEnvelope {
  if (!value || typeof value !== "object") return false;
  const envelope = value as Partial<ColoCacheEnvelope>;
  return (
    envelope.schema === PUBLIC_DETAIL_COLO_CACHE_SCHEMA &&
    typeof envelope.expiresAt === "number" &&
    Number.isSafeInteger(envelope.expiresAt) &&
    envelope.expiresAt > now &&
    envelope.expiresAt <= now + ttlMs &&
    Object.hasOwn(envelope, "value")
  );
}

function validColoCacheResult(
  value: unknown,
  validate: ((result: unknown) => boolean) | undefined,
) {
  try {
    return validate?.(value) ?? false;
  } catch {
    return false;
  }
}

async function readColoCache<T>(
  cacheKey: string,
  ttlMs: number,
  namespace: PublicRuntimeCacheAnalyticsNamespace,
  start: number,
  storeSize: number,
  validateColoCacheResult?: (result: unknown) => boolean,
): Promise<ColoCacheRead<T>> {
  let cache: CloudflareCache | undefined;
  let request: Request | undefined;
  try {
    request = new Request(cacheKey, { method: "GET" });
    const cachePromise = getCloudflareNamedCache(PUBLIC_DETAIL_COLO_CACHE_NAME);
    if (!cachePromise) throw new TypeError("Cache API unavailable");
    cache = await cachePromise;
    const response = await cache.match(request);
    if (!response) {
      writeColoCacheEvent("colo_miss", namespace, start, storeSize, ttlMs);
      return { cache, hit: false, request };
    }

    const parsed: unknown = await response.json();
    const now = Date.now();
    if (
      response.status !== 200 ||
      !validColoCacheEnvelope(parsed, now, ttlMs)
    ) {
      throw new TypeError("Invalid cache envelope");
    }
    if (!validColoCacheResult(parsed.value, validateColoCacheResult)) {
      throw new TypeError("Invalid cached result");
    }
    const value = parsed.value as T;
    writeColoCacheEvent("colo_hit", namespace, start, storeSize, ttlMs);
    return { expiresAt: parsed.expiresAt, hit: true, value };
  } catch {
    writeColoCacheEvent("colo_read_error", namespace, start, storeSize, ttlMs);
    return { cache, hit: false, request };
  }
}

function scheduleColoCacheWrite<T>(
  cache: CloudflareCache,
  request: Request,
  value: T,
  expiresAt: number,
  ttlMs: number,
  namespace: PublicRuntimeCacheAnalyticsNamespace,
  start: number,
  storeSize: number,
) {
  const scheduleTask = getCloudflareRuntimeTaskScheduler();
  const remainingTtlMs = expiresAt - Date.now();
  if (!scheduleTask || remainingTtlMs <= 0) {
    if (!scheduleTask) {
      writeColoCacheEvent(
        "colo_write_error",
        namespace,
        start,
        storeSize,
        ttlMs,
        "scheduler_unavailable",
      );
    }
    return;
  }

  let response: Response;
  try {
    response = new Response(
      JSON.stringify({
        expiresAt,
        schema: PUBLIC_DETAIL_COLO_CACHE_SCHEMA,
        value,
      } satisfies ColoCacheEnvelope),
      {
        headers: {
          "Cache-Control": `public, max-age=${Math.ceil(remainingTtlMs / 1_000)}`,
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  } catch {
    writeColoCacheEvent(
      "colo_write_error",
      namespace,
      start,
      storeSize,
      ttlMs,
      "response_build_failed",
    );
    return;
  }

  let cacheWrite: Promise<void>;
  try {
    cacheWrite = cache.put(request, response);
  } catch {
    writeColoCacheEvent(
      "colo_write_error",
      namespace,
      start,
      storeSize,
      ttlMs,
      "cache_put_rejected",
    );
    return;
  }

  let scheduled = false;
  const write = cacheWrite.then(
    () => {
      if (scheduled) {
        writeColoCacheEvent(
          "colo_write_complete",
          namespace,
          start,
          storeSize,
          ttlMs,
        );
      }
    },
    () => {
      if (scheduled) {
        writeColoCacheEvent(
          "colo_write_error",
          namespace,
          start,
          storeSize,
          ttlMs,
          "cache_put_rejected",
        );
      }
    },
  );
  try {
    scheduleTask(write);
    scheduled = true;
  } catch {
    void write;
    writeColoCacheEvent(
      "colo_write_error",
      namespace,
      start,
      storeSize,
      ttlMs,
      "task_scheduling_failed",
    );
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

export function publicDetailColoCacheKey(
  origin: string,
  kind: PublicDetailColoCacheKind,
  locale: AppLocale,
  id: number,
) {
  const shape = publicDetailColoCacheShapes[kind];
  return new URL(
    `${PUBLIC_DETAIL_COLO_CACHE_PATH}/${kind}/${shape}/${locale}/${encodeURIComponent(String(id))}`,
    origin,
  ).toString();
}

export function cachedPublicRuntimeData<T>(
  analyticsNamespace: PublicRuntimeCacheAnalyticsNamespace,
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  options: PublicRuntimeCacheOptions<T> = {},
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
      namespace: analyticsNamespace,
      storeSize: store.size,
      ttlMs,
    });
    return existing.value;
  }

  writeCacheEventAnalytics({
    event: "miss",
    ioObservedDurationMs: Date.now() - start,
    namespace: analyticsNamespace,
    storeSize: store.size,
    ttlMs,
  });
  const expiresAt = now + ttlMs;
  const initialStoreSize = store.size;
  let value: Promise<T> | undefined;
  value = (async () => {
    const coloRead = options.coloCacheKey
      ? await readColoCache<T>(
          options.coloCacheKey,
          ttlMs,
          analyticsNamespace,
          start,
          initialStoreSize,
          options.validateColoCacheResult,
        )
      : undefined;
    if (coloRead?.hit) {
      if (value) {
        shortenCurrentEntryExpiry(store, key, value, coloRead.expiresAt);
      }
      return coloRead.value;
    }

    const result = await load();
    const retain = options.shouldCacheResult?.(result) ?? true;
    if (!retain) {
      if (value) deleteCurrentEntry(store, key, value);
    } else if (coloRead?.cache && coloRead.request) {
      if (validColoCacheResult(result, options.validateColoCacheResult)) {
        scheduleColoCacheWrite(
          coloRead.cache,
          coloRead.request,
          result,
          expiresAt,
          ttlMs,
          analyticsNamespace,
          start,
          initialStoreSize,
        );
      } else {
        writeColoCacheEvent(
          "colo_write_skip",
          analyticsNamespace,
          start,
          initialStoreSize,
          ttlMs,
          "result_invalid",
        );
      }
    }
    writeCacheEventAnalytics({
      event: "load_success",
      ioObservedDurationMs: Date.now() - start,
      namespace: analyticsNamespace,
      storeSize: store.size,
      ttlMs,
    });
    return result;
  })().catch((error) => {
    if (value) deleteCurrentEntry(store, key, value);
    writeCacheEventAnalytics({
      event: "load_error",
      ioObservedDurationMs: Date.now() - start,
      namespace: analyticsNamespace,
      storeSize: store.size,
      ttlMs,
    });
    throw error;
  });
  store.set(key, { expiresAt, value });
  pruneOldest(store);
  return value;
}
