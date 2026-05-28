import { parseCliInteger } from "./cli-numbers";

const DEFAULT_E2E_AWS_REGION = "us-east-1";
const DEFAULT_MINIO_IMAGE = "minio/minio:RELEASE.2025-09-07T16-13-09Z-cpuv1";
const DEFAULT_MINIO_CONTAINER_NAME = "life-ustc-minio-dev";
const DEFAULT_MINIO_PORT = 9000;
const DEFAULT_MINIO_CONSOLE_PORT = 9001;
const DEFAULT_MINIO_ENDPOINT = "http://127.0.0.1:9000";
const DEFAULT_MINIO_ACCESS_KEY_ID = "minioadmin";
const DEFAULT_MINIO_SECRET_ACCESS_KEY = "minioadmin";
const DEFAULT_MINIO_CORS_ALLOWED_ORIGINS = [
  "http://127.0.0.1:3000",
  "http://localhost:3000",
] as const;
const DEFAULT_MINIO_CORS_ALLOW_ORIGIN =
  DEFAULT_MINIO_CORS_ALLOWED_ORIGINS.join(",");
const DEFAULT_E2E_BUCKET = "life-ustc-e2e";
const MAX_PORT = 65_535;

const DEFAULT_MINIO_HEALTHCHECK_PATH = "/minio/health/live";
const MINIO_STARTUP_ATTEMPTS = 30;
const MINIO_STARTUP_RETRY_MS = 1_000;

function configuredValue(value: string | undefined) {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed && !/^replace-with-/i.test(trimmed) && !/^your-/i.test(trimmed)
    ? trimmed
    : undefined;
}

function resolvePortEnv(value: string | undefined, fallback: number) {
  return String(
    parseCliInteger(configuredValue(value), fallback, {
      min: 1,
      max: MAX_PORT,
    }),
  );
}

export function resolveMinioAwsRegion(env: NodeJS.ProcessEnv = process.env) {
  return configuredValue(env.AWS_REGION) ?? DEFAULT_E2E_AWS_REGION;
}

export function resolveMinioImage(env: NodeJS.ProcessEnv = process.env) {
  return configuredValue(env.MINIO_IMAGE) ?? DEFAULT_MINIO_IMAGE;
}

export function resolveMinioContainerName(
  env: NodeJS.ProcessEnv = process.env,
) {
  return (
    configuredValue(env.MINIO_CONTAINER_NAME) ?? DEFAULT_MINIO_CONTAINER_NAME
  );
}

export function resolveMinioPort(env: NodeJS.ProcessEnv = process.env) {
  return resolvePortEnv(env.MINIO_PORT, DEFAULT_MINIO_PORT);
}

export function resolveMinioConsolePort(env: NodeJS.ProcessEnv = process.env) {
  return resolvePortEnv(env.MINIO_CONSOLE_PORT, DEFAULT_MINIO_CONSOLE_PORT);
}

export function resolvePlaywrightBucketName(
  env: NodeJS.ProcessEnv = process.env,
) {
  return configuredValue(env.PLAYWRIGHT_S3_BUCKET) ?? DEFAULT_E2E_BUCKET;
}

export function resolveMinioEndpoint(env: NodeJS.ProcessEnv = process.env) {
  return configuredValue(env.AWS_ENDPOINT_URL_S3) ?? DEFAULT_MINIO_ENDPOINT;
}

export function resolveMinioCredentials(env: NodeJS.ProcessEnv = process.env) {
  return {
    accessKeyId:
      configuredValue(env.AWS_ACCESS_KEY_ID) ?? DEFAULT_MINIO_ACCESS_KEY_ID,
    secretAccessKey:
      configuredValue(env.AWS_SECRET_ACCESS_KEY) ??
      DEFAULT_MINIO_SECRET_ACCESS_KEY,
  };
}

export function resolveMinioCorsAllowOrigin(
  env: NodeJS.ProcessEnv = process.env,
) {
  return (
    configuredValue(env.MINIO_API_CORS_ALLOW_ORIGIN) ??
    DEFAULT_MINIO_CORS_ALLOW_ORIGIN
  );
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForMinio(
  endpoint = DEFAULT_MINIO_ENDPOINT,
  options?: {
    attempts?: number;
    retryMs?: number;
  },
) {
  const attempts = options?.attempts ?? MINIO_STARTUP_ATTEMPTS;
  const retryMs = options?.retryMs ?? MINIO_STARTUP_RETRY_MS;
  const healthUrl = new URL(DEFAULT_MINIO_HEALTHCHECK_PATH, `${endpoint}/`);

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until the endpoint is ready.
    }

    if (attempt < attempts) {
      await delay(retryMs);
    }
  }

  throw new Error(`MinIO did not become healthy at ${healthUrl.toString()}`);
}
