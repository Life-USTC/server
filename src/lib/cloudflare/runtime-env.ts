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

type CloudflareRuntimeEnv = Record<string, unknown> & {
  HYPERDRIVE?: {
    connectionString?: unknown;
  };
  R2_UPLOADS?: CloudflareR2Bucket;
};

type CloudflareRuntimeContext = {
  cache: Map<symbol, unknown>;
  env?: CloudflareRuntimeEnv;
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
  callback: () => T,
): T {
  return cloudflareRuntimeStorage.run(
    {
      cache: new Map(),
      env: normalizeCloudflareRuntimeEnv(env),
    },
    callback,
  );
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

export function getCloudflareRuntimeEnvInput(): NodeJS.ProcessEnv {
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
