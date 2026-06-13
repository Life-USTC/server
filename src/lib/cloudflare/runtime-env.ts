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
};

type CloudflareRuntimeEnv = Record<string, unknown> & {
  HYPERDRIVE?: {
    connectionString?: unknown;
  };
  R2_UPLOADS?: CloudflareR2Bucket;
};

const globalForCloudflareRuntime = globalThis as typeof globalThis & {
  __lifeUstcCloudflareRuntimeEnv?: CloudflareRuntimeEnv;
};

export function setCloudflareRuntimeEnv(env: unknown) {
  if (env && typeof env === "object") {
    globalForCloudflareRuntime.__lifeUstcCloudflareRuntimeEnv =
      env as CloudflareRuntimeEnv;
  }
}

export function getCloudflareRuntimeEnvInput(): NodeJS.ProcessEnv {
  const env = globalForCloudflareRuntime.__lifeUstcCloudflareRuntimeEnv;
  if (!env) return {};

  return Object.fromEntries(
    Object.entries(env).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

export function hasCloudflareRuntimeEnv() {
  return Boolean(globalForCloudflareRuntime.__lifeUstcCloudflareRuntimeEnv);
}

export function getCloudflareHyperdriveConnectionString() {
  const value =
    globalForCloudflareRuntime.__lifeUstcCloudflareRuntimeEnv?.HYPERDRIVE
      ?.connectionString;
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

export function getCloudflareR2UploadsBucket() {
  return globalForCloudflareRuntime.__lifeUstcCloudflareRuntimeEnv?.R2_UPLOADS;
}
