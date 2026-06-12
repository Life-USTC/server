import * as fs from "node:fs";
import path from "node:path";
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  ReporterDescription,
  ScreenshotMode,
  TraceMode,
} from "@playwright/test";
import { DEV_SEED } from "./seed/dev-seed";

const PLAYWRIGHT_HOST = "127.0.0.1";
const PLAYWRIGHT_PORT = "3000";
const PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3000";
const E2E_AWS_REGION = "us-east-1";
const MINIO_ENDPOINT = "http://127.0.0.1:9000";
const MINIO_ACCESS_KEY_ID = "minioadmin";
const MINIO_SECRET_ACCESS_KEY = "minioadmin";
const E2E_BUCKET = "life-ustc-e2e";
const MINIO_HEALTHCHECK_PATH = "/minio/health/live";
const MINIO_STARTUP_ATTEMPTS = 30;
const MINIO_STARTUP_RETRY_MS = 1_000;
const MINIO_PROVISION_ATTEMPTS = 15;
const MINIO_PROVISION_RETRY_MS = 500;
const DEFAULT_WEB_SERVER_TIMEOUT_MS = 300 * 1000;
const DEFAULT_E2E_DEBUG_PASSWORD = "e2e-debug-local-only";
const DEFAULT_E2E_ADMIN_PASSWORD = "e2e-admin-local-only";

async function waitForMinio(options?: { attempts?: number; retryMs?: number }) {
  const attempts = options?.attempts ?? MINIO_STARTUP_ATTEMPTS;
  const retryMs = options?.retryMs ?? MINIO_STARTUP_RETRY_MS;
  const healthUrl = new URL(MINIO_HEALTHCHECK_PATH, `${MINIO_ENDPOINT}/`);

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

function buildPlaywrightDebugAuthEnv() {
  return {
    E2E_DEBUG_AUTH: "1",
    DEV_DEBUG_USERNAME: DEV_SEED.debugUsername,
    DEV_DEBUG_NAME: DEV_SEED.debugName,
    DEV_DEBUG_PASSWORD: DEFAULT_E2E_DEBUG_PASSWORD,
    DEV_ADMIN_USERNAME: DEV_SEED.adminUsername,
    DEV_ADMIN_NAME: DEV_SEED.adminName,
    DEV_ADMIN_PASSWORD: DEFAULT_E2E_ADMIN_PASSWORD,
  };
}

export function resolvePlaywrightServerRuntime(
  _env: NodeJS.ProcessEnv = process.env,
) {
  return {
    host: PLAYWRIGHT_HOST,
    port: PLAYWRIGHT_PORT,
    baseUrl: PLAYWRIGHT_BASE_URL,
  };
}

export function resolvePlaywrightHarnessRuntime(
  env: NodeJS.ProcessEnv = process.env,
) {
  const { host, port, baseUrl } = resolvePlaywrightServerRuntime(env);
  const isCi = Boolean(env.CI);
  const reporter: ReporterDescription[] = isCi ? [["github"]] : [["list"]];
  const trace: TraceMode = "on-first-retry";
  const screenshot: ScreenshotMode = "only-on-failure";

  return {
    host,
    port,
    baseUrl,
    reuseExistingServer: false,
    retries: isCi ? 2 : 0,
    fullyParallel: false,
    forbidOnly: isCi,
    reporter,
    trace,
    screenshot,
    webServerTimeoutMs: DEFAULT_WEB_SERVER_TIMEOUT_MS,
  };
}

export function buildPlaywrightServerEnv(options: {
  host: string;
  port: string;
  baseUrl?: string;
  env?: NodeJS.ProcessEnv;
}): Record<string, string> {
  const env = options.env ?? process.env;
  const baseUrl = options.baseUrl ?? `http://${options.host}:${options.port}`;

  const serverEnv = Object.fromEntries(
    Object.entries({
      ...env,
      HOST: options.host,
      PORT: options.port,
      ORIGIN: baseUrl,
      APP_PUBLIC_ORIGIN: baseUrl,
      ...buildPlaywrightDebugAuthEnv(),
      S3_BUCKET: E2E_BUCKET,
      AWS_REGION: E2E_AWS_REGION,
      AWS_ACCESS_KEY_ID: MINIO_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: MINIO_SECRET_ACCESS_KEY,
      AWS_ENDPOINT_URL_S3: MINIO_ENDPOINT,
    }).filter(([, value]) => value !== undefined),
  ) as Record<string, string>;

  if (serverEnv.FORCE_COLOR) {
    delete serverEnv.NO_COLOR;
  }

  return serverEnv;
}

function copyDirectoryContents(source: string, target: string) {
  if (!fs.existsSync(source)) {
    return;
  }

  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source)) {
    fs.cpSync(path.join(source, entry), path.join(target, entry), {
      recursive: true,
    });
  }
}

export function preparePlaywrightStandaloneRuntime(root = process.cwd()) {
  resolveStandaloneServerPath(
    root,
    "bun run test:e2e:prepare or bun run build",
  );

  copyDirectoryContents(
    path.join(root, "public"),
    path.join(root, "build", "client"),
  );
}

function resolveStandaloneServerPath(
  root = process.cwd(),
  commandHint = "bun run build",
) {
  const adapterServerPath = path.join(root, "build", "index.js");
  if (fs.existsSync(adapterServerPath)) {
    return adapterServerPath;
  }

  throw new Error(
    `Missing SvelteKit adapter-node server. Run \`${commandHint}\` before starting the standalone app.`,
  );
}

export function assertPlaywrightDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
) {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for E2E global setup");
  }
}

function isBucketMissingError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.name === "NotFound" || error.name === "NoSuchBucket";
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function retry<T>(attempts: number, fn: () => Promise<T>) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await delay(MINIO_PROVISION_RETRY_MS);
      }
    }
  }
  throw lastError;
}

export async function ensurePlaywrightMinio(
  _env: NodeJS.ProcessEnv = process.env,
) {
  await waitForMinio();
}

export async function provisionPlaywrightBucket(
  _env: NodeJS.ProcessEnv = process.env,
) {
  const s3 = new S3Client({
    region: E2E_AWS_REGION,
    endpoint: MINIO_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: MINIO_ACCESS_KEY_ID,
      secretAccessKey: MINIO_SECRET_ACCESS_KEY,
    },
  });

  await retry(MINIO_PROVISION_ATTEMPTS, async () => {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: E2E_BUCKET }));
      return;
    } catch (error) {
      if (!isBucketMissingError(error)) {
        throw error;
      }
    }

    await s3.send(new CreateBucketCommand({ Bucket: E2E_BUCKET }));
  });

  const smokeKey = `e2e-smoke/${Date.now()}.txt`;
  await retry(MINIO_PROVISION_ATTEMPTS, async () => {
    const smokeUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: E2E_BUCKET,
        Key: smokeKey,
        ContentType: "text/plain",
      }),
      { expiresIn: 60 },
    );
    const smokeRes = await fetch(smokeUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: "ok",
    });

    if (!smokeRes.ok) {
      throw new Error(
        `MinIO smoke upload failed (${smokeRes.status}). ` +
          "Is MinIO running? Start it with: docker compose -f docker-compose.dev.yml up -d minio",
      );
    }
  });
}

export async function bootstrapPlaywrightData(
  env: NodeJS.ProcessEnv = process.env,
) {
  assertPlaywrightDatabaseUrl(env);
  await ensurePlaywrightMinio(env);
  await provisionPlaywrightBucket(env);
}

if (process.argv[1]?.endsWith("e2e.ts")) {
  await import("dotenv/config");

  const command = process.argv[2];

  if (command === "prepare") {
    preparePlaywrightStandaloneRuntime();
  } else {
    console.error("Usage: bun run tools/dev/e2e.ts prepare");
    process.exit(2);
  }
}
