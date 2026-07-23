import { AsyncLocalStorage } from "node:async_hooks";

export type CloudflareR2Object = {
  body?: ReadableStream<Uint8Array>;
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
    options?: { httpMetadata?: { contentType?: string } },
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

type CloudflareExecutionContext = {
  tracing?: CloudflareTracing;
  waitUntil(promise: Promise<unknown>): void;
};

type CloudflareSpan = {
  setAttribute(key: string, value?: boolean | number | string): void;
};

type CloudflareTracing = {
  enterSpan<T>(name: string, callback: (span: CloudflareSpan) => T): T;
};

export type CloudflareKVNamespace = {
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
  CALENDAR_EXPORTS?: CloudflareKVNamespace;
  HYPERDRIVE?: {
    connectionString?: unknown;
  };
  R2_UPLOADS?: CloudflareR2Bucket;
  USER_BATCH_WRITE_RATE_LIMITER?: CloudflareRateLimiter;
  USER_WRITE_RATE_LIMITER?: CloudflareRateLimiter;
};

type CloudflareRuntimeContext = {
  cache: Map<symbol, unknown>;
  env?: CloudflareRuntimeEnv;
  tracing?: CloudflareTracing;
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

function getCurrentCloudflareRuntimeEnv() {
  const context = cloudflareRuntimeStorage.getStore();
  if (context) return context.env;
  return globalForCloudflareRuntime.__lifeUstcCloudflareRuntimeEnv;
}

export function runWithCloudflareRuntimeEnv<T>(
  env: unknown,
  callback: () => T | Promise<T>,
  executionContext?: unknown,
): Promise<T> {
  const tracing =
    executionContext &&
    typeof executionContext === "object" &&
    "tracing" in executionContext &&
    executionContext.tracing &&
    typeof executionContext.tracing === "object" &&
    "enterSpan" in executionContext.tracing &&
    typeof executionContext.tracing.enterSpan === "function"
      ? (executionContext.tracing as CloudflareTracing)
      : undefined;
  const context: CloudflareRuntimeContext = {
    cache: new Map(),
    env: normalizeCloudflareRuntimeEnv(env),
    tracing,
  };

  return cloudflareRuntimeStorage.run(context, async () => {
    try {
      return await callback();
    } finally {
      context.cache.clear();
    }
  });
}

export function runCloudflareTraceSpan<T>(
  name: string,
  attributes: Record<string, boolean | number | string | undefined>,
  callback: () => T,
): T {
  const tracing = cloudflareRuntimeStorage.getStore()?.tracing;
  if (!tracing) return callback();

  return tracing.enterSpan(name, (span) => {
    for (const [key, value] of Object.entries(attributes)) {
      if (value !== undefined) span.setAttribute(key, value);
    }
    return callback();
  });
}

export function getCloudflareRuntimeContext() {
  const context = cloudflareRuntimeStorage.getStore();
  return context?.env ? context : undefined;
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

export function getCloudflareR2UploadsBucket() {
  return getCurrentCloudflareRuntimeEnv()?.R2_UPLOADS;
}

export function getCloudflareAnalyticsEngineDataset() {
  return getCurrentCloudflareRuntimeEnv()?.ANALYTICS;
}

export function getCloudflareCalendarExportsNamespace() {
  return getCurrentCloudflareRuntimeEnv()?.CALENDAR_EXPORTS;
}

export function getCloudflareTaskScheduler(platform: unknown) {
  if (!platform || typeof platform !== "object") return undefined;
  const value = platform as { context?: unknown; ctx?: unknown };
  const context = value.ctx ?? value.context;
  if (!context || typeof context !== "object" || !("waitUntil" in context)) {
    return undefined;
  }
  const executionContext = context as Partial<CloudflareExecutionContext>;
  if (typeof executionContext.waitUntil !== "function") return undefined;

  return (promise: Promise<unknown>) => {
    executionContext.waitUntil?.(promise);
  };
}

export function getCloudflareUserMutationRateLimiter(tier: "batch" | "write") {
  const env = getCurrentCloudflareRuntimeEnv();
  return tier === "batch"
    ? env?.USER_BATCH_WRITE_RATE_LIMITER
    : env?.USER_WRITE_RATE_LIMITER;
}
