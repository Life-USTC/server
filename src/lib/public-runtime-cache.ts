import type { AppLocale } from "@/i18n/config";
import {
  type CloudflareCache,
  getCloudflareCatalogDetailCoreNamespace,
  getCloudflareNamedCache,
  getCloudflareRuntimeTaskScheduler,
  runCloudflareTraceSpan,
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
  kvCacheKey?: string;
  kvTtlMs?: number;
  shouldCacheResult?: (result: T) => boolean;
  validateColoCacheResult?: (result: unknown) => boolean;
};

type RuntimeCacheEnvelope = {
  expiresAt: number;
  schema: string;
  value: unknown;
};

type RuntimeCacheRead<T> =
  | { expiresAt: number; hit: true; outcome: "hit"; value: T }
  | { hit: false; outcome: "error" | "invalid" | "miss" | "unavailable" };

type ColoCacheRead<T> =
  | { expiresAt: number; hit: true; outcome: "hit"; value: T }
  | {
      cache?: CloudflareCache;
      hit: false;
      outcome: "error" | "invalid" | "miss";
      request?: Request;
    };

type RuntimeCacheEvent =
  | "colo_hit"
  | "colo_miss"
  | "colo_read_error"
  | "colo_write_error"
  | "colo_write_complete"
  | "colo_write_skip"
  | "kv_hit"
  | "kv_miss"
  | "kv_read_error"
  | "kv_write_complete"
  | "kv_write_error"
  | "kv_write_skip";

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

export function resetPublicRuntimeCacheForTest() {
  globalForPublicRuntimeCache.__lifeUstcPublicRuntimeCache?.clear();
}

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

function writeRuntimeCacheEvent(
  event: RuntimeCacheEvent,
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

function validRuntimeCacheEnvelope(
  value: unknown,
  now: number,
  ttlMs: number,
): value is RuntimeCacheEnvelope {
  if (!value || typeof value !== "object") return false;
  const envelope = value as Partial<RuntimeCacheEnvelope>;
  return (
    envelope.schema === PUBLIC_DETAIL_COLO_CACHE_SCHEMA &&
    typeof envelope.expiresAt === "number" &&
    Number.isSafeInteger(envelope.expiresAt) &&
    envelope.expiresAt > now &&
    envelope.expiresAt <= now + ttlMs &&
    Object.hasOwn(envelope, "value")
  );
}

function validRuntimeCacheResult(
  value: unknown,
  validate: ((result: unknown) => boolean) | undefined,
) {
  try {
    return validate?.(value) ?? true;
  } catch {
    return false;
  }
}

async function readKvCache<T>(
  cacheKey: string,
  ttlMs: number,
  namespace: PublicRuntimeCacheAnalyticsNamespace,
  storeSize: number,
  validateColoCacheResult?: (result: unknown) => boolean,
): Promise<RuntimeCacheRead<T>> {
  const kv = getCloudflareCatalogDetailCoreNamespace();
  if (!kv) return { hit: false, outcome: "unavailable" };

  const start = Date.now();
  let failureOutcome: "error" | "invalid" = "error";
  const cacheTtlSeconds = Math.ceil(ttlMs / 1_000);
  try {
    const parsed = await kv.get<RuntimeCacheEnvelope>(cacheKey, {
      cacheTtl: cacheTtlSeconds,
      type: "json",
    });
    const now = Date.now();
    if (!parsed || !validRuntimeCacheEnvelope(parsed, now, ttlMs)) {
      writeRuntimeCacheEvent("kv_miss", namespace, start, storeSize, ttlMs);
      return { hit: false, outcome: "miss" };
    }
    if (!validRuntimeCacheResult(parsed.value, validateColoCacheResult)) {
      failureOutcome = "invalid";
      throw new TypeError("Invalid cached result");
    }
    const value = parsed.value as T;
    writeRuntimeCacheEvent("kv_hit", namespace, start, storeSize, ttlMs);
    return { expiresAt: parsed.expiresAt, hit: true, outcome: "hit", value };
  } catch {
    writeRuntimeCacheEvent("kv_read_error", namespace, start, storeSize, ttlMs);
    return { hit: false, outcome: failureOutcome };
  }
}

function scheduleKvCacheWrite<T>(
  cacheKey: string,
  value: T,
  expiresAt: number,
  ttlMs: number,
  namespace: PublicRuntimeCacheAnalyticsNamespace,
  storeSize: number,
  validateColoCacheResult?: (result: unknown) => boolean,
) {
  const start = Date.now();
  const kv = getCloudflareCatalogDetailCoreNamespace();
  const scheduleTask = getCloudflareRuntimeTaskScheduler();
  const remainingTtlMs = expiresAt - Date.now();
  if (!kv) return;
  if (!scheduleTask || remainingTtlMs <= 0) {
    if (!scheduleTask) {
      writeRuntimeCacheEvent(
        "kv_write_error",
        namespace,
        start,
        storeSize,
        ttlMs,
        "scheduler_unavailable",
      );
    }
    return;
  }

  if (!validRuntimeCacheResult(value, validateColoCacheResult)) {
    writeRuntimeCacheEvent(
      "kv_write_skip",
      namespace,
      start,
      storeSize,
      ttlMs,
      "result_invalid",
    );
    return;
  }

  let serialized: string;
  try {
    serialized = JSON.stringify({
      expiresAt,
      schema: PUBLIC_DETAIL_COLO_CACHE_SCHEMA,
      value,
    } satisfies RuntimeCacheEnvelope);
  } catch {
    writeRuntimeCacheEvent(
      "kv_write_error",
      namespace,
      start,
      storeSize,
      ttlMs,
      "response_build_failed",
    );
    return;
  }

  let kvWrite: Promise<void>;
  try {
    kvWrite = kv.put(cacheKey, serialized, {
      expirationTtl: Math.ceil(remainingTtlMs / 1_000),
    });
  } catch {
    writeRuntimeCacheEvent(
      "kv_write_error",
      namespace,
      start,
      storeSize,
      ttlMs,
      "cache_put_rejected",
    );
    return;
  }

  let scheduled = false;
  const write = kvWrite.then(
    () => {
      if (scheduled) {
        writeRuntimeCacheEvent(
          "kv_write_complete",
          namespace,
          start,
          storeSize,
          ttlMs,
        );
      }
    },
    () => {
      if (scheduled) {
        writeRuntimeCacheEvent(
          "kv_write_error",
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
    writeRuntimeCacheEvent(
      "kv_write_error",
      namespace,
      start,
      storeSize,
      ttlMs,
      "task_scheduling_failed",
    );
  }
}

async function readColoCache<T>(
  cacheKey: string,
  ttlMs: number,
  namespace: PublicRuntimeCacheAnalyticsNamespace,
  storeSize: number,
  validateColoCacheResult?: (result: unknown) => boolean,
): Promise<ColoCacheRead<T>> {
  const start = Date.now();
  let failureOutcome: "error" | "invalid" = "error";
  let cache: CloudflareCache | undefined;
  let request: Request | undefined;
  try {
    request = new Request(cacheKey, { method: "GET" });
    const cachePromise = getCloudflareNamedCache(PUBLIC_DETAIL_COLO_CACHE_NAME);
    if (!cachePromise) throw new TypeError("Cache API unavailable");
    cache = await cachePromise;
    const response = await cache.match(request);
    if (!response) {
      writeRuntimeCacheEvent("colo_miss", namespace, start, storeSize, ttlMs);
      return { cache, hit: false, outcome: "miss", request };
    }

    const parsed: unknown = await response.json();
    const now = Date.now();
    if (
      response.status !== 200 ||
      !validRuntimeCacheEnvelope(parsed, now, ttlMs)
    ) {
      failureOutcome = "invalid";
      throw new TypeError("Invalid cache envelope");
    }
    if (!validRuntimeCacheResult(parsed.value, validateColoCacheResult)) {
      failureOutcome = "invalid";
      throw new TypeError("Invalid cached result");
    }
    const value = parsed.value as T;
    writeRuntimeCacheEvent("colo_hit", namespace, start, storeSize, ttlMs);
    return { expiresAt: parsed.expiresAt, hit: true, outcome: "hit", value };
  } catch {
    writeRuntimeCacheEvent(
      "colo_read_error",
      namespace,
      start,
      storeSize,
      ttlMs,
    );
    return { cache, hit: false, outcome: failureOutcome, request };
  }
}

function scheduleColoCacheWrite<T>(
  cache: CloudflareCache,
  request: Request,
  value: T,
  expiresAt: number,
  ttlMs: number,
  namespace: PublicRuntimeCacheAnalyticsNamespace,
  storeSize: number,
) {
  const start = Date.now();
  const scheduleTask = getCloudflareRuntimeTaskScheduler();
  const remainingTtlMs = expiresAt - Date.now();
  if (!scheduleTask || remainingTtlMs <= 0) {
    if (!scheduleTask) {
      writeRuntimeCacheEvent(
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
      } satisfies RuntimeCacheEnvelope),
      {
        headers: {
          "Cache-Control": `public, max-age=${Math.ceil(remainingTtlMs / 1_000)}`,
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  } catch {
    writeRuntimeCacheEvent(
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
    writeRuntimeCacheEvent(
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
        writeRuntimeCacheEvent(
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
        writeRuntimeCacheEvent(
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
    writeRuntimeCacheEvent(
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

export function publicDetailKvCacheKey(
  revision: string,
  kind: PublicDetailColoCacheKind,
  locale: AppLocale,
  id: number,
  shape: string,
) {
  return `v1:${revision}:${kind}:${locale}:${id}:${shape}`;
}

function resolvePublicDetailKvCacheKey(options: {
  coloCacheKey?: string;
  kvCacheKey?: string;
}) {
  if (options.kvCacheKey) return options.kvCacheKey;
  if (!options.coloCacheKey) return undefined;

  try {
    const url = new URL(options.coloCacheKey);
    const parts = url.pathname.split("/").filter(Boolean);
    const versionIndex = parts.indexOf("v1");
    if (versionIndex === -1 || parts.length < versionIndex + 5) {
      return undefined;
    }
    const kind = parts[versionIndex + 1];
    const shape = parts[versionIndex + 2];
    const locale = parts[versionIndex + 3];
    const id = decodeURIComponent(parts[versionIndex + 4] ?? "");
    if (!kind || !shape || !locale || !id) return undefined;
    return `v1:${kind}:${locale}:${id}:${shape}`;
  } catch {
    return undefined;
  }
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
  const storeKey = JSON.stringify([analyticsNamespace, key]);
  pruneExpired(store, now);

  const existing = store.get(storeKey) as CacheEntry<T> | undefined;
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
    const kvCacheKey =
      options.kvCacheKey ?? resolvePublicDetailKvCacheKey(options);
    const kvTtlMs = options.kvTtlMs ?? ttlMs;
    const kvRead = kvCacheKey
      ? await runCloudflareTraceSpan(
          "cache.kv.read",
          {
            "cache.layer": "kv",
            "cache.namespace": analyticsNamespace,
          },
          async (span) => {
            const result = await readKvCache<T>(
              kvCacheKey,
              kvTtlMs,
              analyticsNamespace,
              initialStoreSize,
              options.validateColoCacheResult,
            );
            span?.setAttribute("cache.outcome", result.outcome);
            return result;
          },
        )
      : undefined;
    if (kvRead?.hit) {
      if (value) {
        shortenCurrentEntryExpiry(store, storeKey, value, kvRead.expiresAt);
      }
      return kvRead.value;
    }

    const coloCacheKey = options.coloCacheKey;
    const coloRead = coloCacheKey
      ? await runCloudflareTraceSpan(
          "cache.colo.read",
          {
            "cache.layer": "colo",
            "cache.namespace": analyticsNamespace,
          },
          async (span) => {
            const result = await readColoCache<T>(
              coloCacheKey,
              ttlMs,
              analyticsNamespace,
              initialStoreSize,
              options.validateColoCacheResult,
            );
            span?.setAttribute("cache.outcome", result.outcome);
            return result;
          },
        )
      : undefined;
    if (coloRead?.hit) {
      if (value) {
        shortenCurrentEntryExpiry(store, storeKey, value, coloRead.expiresAt);
      }
      return coloRead.value;
    }

    const loadStart = Date.now();
    let result: T;
    try {
      result = await runCloudflareTraceSpan(
        "cache.origin_load",
        {
          "cache.layer": "origin",
          "cache.namespace": analyticsNamespace,
        },
        async (span) => {
          try {
            const loaded = await load();
            span?.setAttribute("cache.outcome", "success");
            return loaded;
          } catch (error) {
            span?.setAttribute("cache.outcome", "error");
            throw error;
          }
        },
      );
      writeCacheEventAnalytics({
        event: "load_success",
        ioObservedDurationMs: Date.now() - loadStart,
        namespace: analyticsNamespace,
        storeSize: store.size,
        ttlMs,
      });
    } catch (error) {
      writeCacheEventAnalytics({
        event: "load_error",
        ioObservedDurationMs: Date.now() - loadStart,
        namespace: analyticsNamespace,
        storeSize: store.size,
        ttlMs,
      });
      throw error;
    }
    const retain = options.shouldCacheResult?.(result) ?? true;
    if (!retain) {
      if (value) deleteCurrentEntry(store, storeKey, value);
    } else {
      const resultValid = validRuntimeCacheResult(
        result,
        options.validateColoCacheResult,
      );
      if (resultValid) {
        const kvTtlMs = options.kvTtlMs ?? ttlMs;
        if (kvCacheKey) {
          scheduleKvCacheWrite(
            kvCacheKey,
            result,
            Date.now() + kvTtlMs,
            kvTtlMs,
            analyticsNamespace,
            initialStoreSize,
            options.validateColoCacheResult,
          );
        }
        if (coloRead?.cache && coloRead.request) {
          scheduleColoCacheWrite(
            coloRead.cache,
            coloRead.request,
            result,
            expiresAt,
            ttlMs,
            analyticsNamespace,
            initialStoreSize,
          );
        }
      } else {
        if (kvCacheKey) {
          writeRuntimeCacheEvent(
            "kv_write_skip",
            analyticsNamespace,
            start,
            initialStoreSize,
            ttlMs,
            "result_invalid",
          );
        }
        if (coloRead?.cache && coloRead.request) {
          writeRuntimeCacheEvent(
            "colo_write_skip",
            analyticsNamespace,
            start,
            initialStoreSize,
            ttlMs,
            "result_invalid",
          );
        }
      }
    }
    return result;
  })().catch((error) => {
    if (value) deleteCurrentEntry(store, storeKey, value);
    throw error;
  });
  store.set(storeKey, { expiresAt, value });
  pruneOldest(store);
  return value;
}
