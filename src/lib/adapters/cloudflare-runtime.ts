import { AsyncLocalStorage } from "node:async_hooks";

export type CloudflareR2Object = {
  body?: ReadableStream<Uint8Array>;
  checksums?: { sha256?: ArrayBuffer };
  customMetadata?: Record<string, string>;
  etag?: string;
  httpMetadata?: { contentType?: string };
  size: number;
};

export type CloudflareR2Bucket = {
  delete(key: string): Promise<void>;
  get(
    key: string,
  ): Promise<
    (CloudflareR2Object & { body: ReadableStream<Uint8Array> }) | null
  >;
  head(key: string): Promise<CloudflareR2Object | null>;
  put(
    key: string,
    value:
      | ReadableStream<Uint8Array>
      | ArrayBuffer
      | ArrayBufferView
      | string
      | null,
    options?: {
      customMetadata?: Record<string, string>;
      httpMetadata?: { contentType?: string };
      sha256?: ArrayBuffer | string;
    },
  ): Promise<unknown>;
};

export type CloudflareAnalyticsEngineDataPoint = {
  blobs?: ((ArrayBuffer | string) | null)[];
  doubles?: number[];
  indexes?: ((ArrayBuffer | string) | null)[];
};

export type CloudflareAnalyticsEngineDataset = {
  writeDataPoint(event?: CloudflareAnalyticsEngineDataPoint): void;
};

export type CloudflareRateLimiter = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

export type CloudflareAssetsBinding = {
  fetch(request: Request): Promise<Response>;
};

type CloudflareExecutionContext = {
  tracing?: CloudflareTracing;
  waitUntil(promise: Promise<unknown>): void;
};

export type CloudflareCache = {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
};

type CloudflareCacheStorage = {
  open(name: string): Promise<CloudflareCache>;
};

type CloudflareTaskScheduler = (promise: Promise<unknown>) => void;

export type CloudflareTraceSpan = {
  readonly isTraced: boolean;
  setAttribute(key: string, value?: boolean | number | string): void;
};

type CloudflareTracing = {
  enterSpan<T>(name: string, callback: (span: CloudflareTraceSpan) => T): T;
};

export type CloudflareQueueSendOptions = {
  contentType?: string;
  delaySeconds?: number;
};

export type CloudflareQueue = {
  send(message: unknown, options?: CloudflareQueueSendOptions): Promise<void>;
  sendBatch?(
    messages: Array<{ body: unknown; options?: CloudflareQueueSendOptions }>,
  ): Promise<void>;
};

export type CloudflareKVNamespace = {
  delete(key: string): Promise<void>;
  get<T = unknown>(
    key: string,
    options: { cacheTtl?: number; type: "json" },
  ): Promise<T | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
};

type CloudflareRuntimeEnv = Record<string, unknown> & {
  ANALYTICS?: CloudflareAnalyticsEngineDataset;
  AUDIT_LOG_WRITES?: CloudflareQueue;
  ASSETS?: CloudflareAssetsBinding;
  CALENDAR_EXPORT_REBUILD?: CloudflareQueue;
  CALENDAR_EXPORTS?: CloudflareKVNamespace;
  CATALOG_DETAIL_CORE?: CloudflareKVNamespace;
  HYPERDRIVE?: {
    connectionString?: unknown;
  };
  HYPERDRIVE_AUTH?: {
    connectionString?: unknown;
  };
  HYPERDRIVE_MAINTENANCE?: {
    connectionString?: unknown;
  };
  R2_UPLOADS?: CloudflareR2Bucket;
  R2_PUBLICATIONS?: CloudflareR2Bucket;
  USER_BATCH_WRITE_RATE_LIMITER?: CloudflareRateLimiter;
  USER_WRITE_RATE_LIMITER?: CloudflareRateLimiter;
  WEATHER?: CloudflareKVNamespace;
};

type CloudflareRuntimeContext = {
  cache: Map<symbol, unknown>;
  cacheStorage?: CloudflareCacheStorage;
  cleanups: Set<() => Promise<void> | void>;
  env?: CloudflareRuntimeEnv;
  request?: CloudflareRequestContext;
  scheduleTask?: CloudflareTaskScheduler;
  tracing?: CloudflareTracing;
};

export type CloudflareRequestContext = {
  method: string;
  requestId: string;
  route: string;
};

const cloudflareRuntimeStorage =
  new AsyncLocalStorage<CloudflareRuntimeContext>();

const globalForCloudflareRuntime = globalThis as typeof globalThis & {
  __lifeUstcCloudflareRuntimeEnv?: CloudflareRuntimeEnv;
};

function normalizeCloudflareRuntimeEnv(env: unknown) {
  return env && typeof env === "object"
    ? (env as CloudflareRuntimeEnv)
    : undefined;
}

function normalizeCloudflareCacheStorage() {
  const value = (globalThis as typeof globalThis & { caches?: unknown }).caches;
  if (!value || typeof value !== "object" || !("open" in value)) {
    return undefined;
  }
  const cacheStorage = value as Partial<CloudflareCacheStorage>;
  return typeof cacheStorage.open === "function"
    ? (cacheStorage as CloudflareCacheStorage)
    : undefined;
}

function normalizeCloudflareTaskScheduler(
  executionContext: unknown,
): CloudflareTaskScheduler | undefined {
  if (
    !executionContext ||
    typeof executionContext !== "object" ||
    !("waitUntil" in executionContext)
  ) {
    return undefined;
  }
  const context = executionContext as Partial<CloudflareExecutionContext>;
  if (typeof context.waitUntil !== "function") return undefined;

  return (promise) => {
    context.waitUntil?.(promise);
  };
}

function getCurrentCloudflareRuntimeEnv() {
  const context = cloudflareRuntimeStorage.getStore();
  if (context) return context.env;
  return globalForCloudflareRuntime.__lifeUstcCloudflareRuntimeEnv;
}

async function cleanupCloudflareRuntimeContext(
  context: CloudflareRuntimeContext,
) {
  const cleanupResults = await Promise.allSettled(
    [...context.cleanups].map((cleanup) => Promise.resolve().then(cleanup)),
  );
  context.cache.clear();
  context.cleanups.clear();
  const failures = cleanupResults
    .filter(
      (cleanupResult): cleanupResult is PromiseRejectedResult =>
        cleanupResult.status === "rejected",
    )
    .map((cleanupResult) => cleanupResult.reason);
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) {
    throw new AggregateError(failures, "Cloudflare runtime cleanup failed");
  }
}

function responseWithRuntimeCleanup(
  response: Response,
  cleanup: () => Promise<void>,
) {
  if (!response.body) return response;
  const reader = response.body.getReader();
  const body = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        try {
          const chunk = await reader.read();
          if (!chunk.done) {
            controller.enqueue(chunk.value);
            return;
          }
          await cleanup();
          controller.close();
        } catch (error) {
          await cleanup().catch(() => undefined);
          controller.error(error);
        }
      },
      async cancel(reason) {
        try {
          await reader.cancel(reason);
        } finally {
          await cleanup();
        }
      },
    },
    { highWaterMark: 0 },
  );
  return new Response(body, response);
}

export function runWithCloudflareRuntimeEnv<T>(
  env: unknown,
  callback: () => T | Promise<T>,
  executionContext?: unknown,
): Promise<T> {
  const parentContext = cloudflareRuntimeStorage.getStore();
  const tracing =
    executionContext &&
    typeof executionContext === "object" &&
    "tracing" in executionContext &&
    executionContext.tracing &&
    typeof executionContext.tracing === "object" &&
    "enterSpan" in executionContext.tracing &&
    typeof executionContext.tracing.enterSpan === "function"
      ? (executionContext.tracing as CloudflareTracing)
      : parentContext?.tracing;
  const context: CloudflareRuntimeContext = {
    cache: new Map(),
    cacheStorage: normalizeCloudflareCacheStorage(),
    cleanups: new Set(),
    env: normalizeCloudflareRuntimeEnv(env) ?? parentContext?.env,
    request: parentContext?.request,
    scheduleTask:
      normalizeCloudflareTaskScheduler(executionContext) ??
      parentContext?.scheduleTask,
    tracing,
  };

  return cloudflareRuntimeStorage.run(context, async () => {
    let cleanupPromise: Promise<void> | undefined;
    const cleanup = () => {
      cleanupPromise ??= cleanupCloudflareRuntimeContext(context);
      return cleanupPromise;
    };
    let result: T;
    try {
      result = await callback();
    } catch (error) {
      await cleanup().catch(() => undefined);
      throw error;
    }
    if (
      result instanceof Response &&
      result.body &&
      context.cleanups.size > 0
    ) {
      return responseWithRuntimeCleanup(result, cleanup) as T;
    }
    await cleanup();
    return result;
  });
}

export function registerCloudflareRuntimeCleanup(
  cleanup: () => Promise<void> | void,
) {
  cloudflareRuntimeStorage.getStore()?.cleanups.add(cleanup);
}

export function runCloudflareTraceSpan<T>(
  name: string,
  attributes: Record<string, boolean | number | string | undefined>,
  callback: (span?: CloudflareTraceSpan) => T,
): T {
  const tracing = cloudflareRuntimeStorage.getStore()?.tracing;
  if (!tracing) return callback(undefined);

  return tracing.enterSpan(name, (span) => {
    for (const [key, value] of Object.entries(attributes)) {
      if (value !== undefined) span.setAttribute(key, value);
    }
    return callback(span);
  });
}

export function getCloudflareRuntimeContext() {
  const context = cloudflareRuntimeStorage.getStore();
  return context?.env ? context : undefined;
}

export function getCloudflareRequestContext() {
  return cloudflareRuntimeStorage.getStore()?.request;
}

export function setCloudflareRequestContext(request: CloudflareRequestContext) {
  const context = cloudflareRuntimeStorage.getStore();
  if (context) context.request = request;
}

export function setCloudflareRuntimeEnv(env: unknown) {
  const runtimeEnv = normalizeCloudflareRuntimeEnv(env);
  if (runtimeEnv) {
    globalForCloudflareRuntime.__lifeUstcCloudflareRuntimeEnv = runtimeEnv;
    return;
  }
  delete globalForCloudflareRuntime.__lifeUstcCloudflareRuntimeEnv;
}

export function getCloudflareRuntimeEnvInput(): Partial<NodeJS.ProcessEnv> {
  const env = getCurrentCloudflareRuntimeEnv();
  if (!env) return {};

  return Object.fromEntries(
    Object.entries(env).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

export function hasCloudflareRuntimeEnv() {
  return Boolean(getCurrentCloudflareRuntimeEnv());
}

export function getCloudflareHyperdriveConnectionString() {
  const value = getCurrentCloudflareRuntimeEnv()?.HYPERDRIVE?.connectionString;
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

export function getCloudflareAuthHyperdriveConnectionString() {
  const value =
    getCurrentCloudflareRuntimeEnv()?.HYPERDRIVE_AUTH?.connectionString;
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

export function getCloudflareMaintenanceHyperdriveConnectionString() {
  const value =
    getCurrentCloudflareRuntimeEnv()?.HYPERDRIVE_MAINTENANCE?.connectionString;
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

export function getCloudflareR2UploadsBucket() {
  return getCurrentCloudflareRuntimeEnv()?.R2_UPLOADS;
}

export function getCloudflareR2PublicationsBucket() {
  return getCurrentCloudflareRuntimeEnv()?.R2_PUBLICATIONS;
}

export function getCloudflareAnalyticsEngineDataset() {
  return getCurrentCloudflareRuntimeEnv()?.ANALYTICS;
}

export function getCloudflareAuditLogWriteQueue() {
  return getCurrentCloudflareRuntimeEnv()?.AUDIT_LOG_WRITES;
}

export function getCloudflareAssetsBinding() {
  return getCurrentCloudflareRuntimeEnv()?.ASSETS;
}

export function getCloudflareCalendarExportsNamespace() {
  return getCurrentCloudflareRuntimeEnv()?.CALENDAR_EXPORTS;
}

export function getCloudflareCalendarExportRebuildQueue() {
  return getCurrentCloudflareRuntimeEnv()?.CALENDAR_EXPORT_REBUILD;
}

export function getCloudflareCatalogDetailCoreNamespace() {
  return getCurrentCloudflareRuntimeEnv()?.CATALOG_DETAIL_CORE;
}

export function getCloudflareNamedCache(name: string) {
  return cloudflareRuntimeStorage.getStore()?.cacheStorage?.open(name);
}

export function getCloudflareRuntimeTaskScheduler() {
  return cloudflareRuntimeStorage.getStore()?.scheduleTask;
}

export function getCloudflareTaskScheduler(platform: unknown) {
  if (!platform || typeof platform !== "object") return undefined;
  const value = platform as { context?: unknown; ctx?: unknown };
  const context = value.ctx ?? value.context;
  return normalizeCloudflareTaskScheduler(context);
}

export function getCloudflareUserMutationRateLimiter(tier: "batch" | "write") {
  const env = getCurrentCloudflareRuntimeEnv();
  return tier === "batch"
    ? env?.USER_BATCH_WRITE_RATE_LIMITER
    : env?.USER_WRITE_RATE_LIMITER;
}

export function getCloudflareWeatherNamespace() {
  return getCurrentCloudflareRuntimeEnv()?.WEATHER;
}
