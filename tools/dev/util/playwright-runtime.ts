import { execSync, spawn } from "node:child_process";
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
import { DEV_SEED } from "../seed/dev-seed";
import { resolveAppPort, resolveStandaloneServerPath } from "./app-runtime";
import { parseCliInteger, parseOptionalCliInteger } from "./cli-numbers";
import {
  resolveMinioAwsRegion,
  resolveMinioCredentials,
  resolveMinioEndpoint,
  resolvePlaywrightBucketName,
} from "./minio-runtime";

const PLAYWRIGHT_NO_PROXY = "127.0.0.1,localhost,::1";
const MINIO_PROVISION_ATTEMPTS = 15;
const MINIO_PROVISION_RETRY_MS = 500;
const DEFAULT_PLAYWRIGHT_WORKERS = 4;
const MAX_PORT = 65_535;
const DEFAULT_WEB_SERVER_TIMEOUT_MS = 300 * 1000;
const DEFAULT_E2E_DEBUG_PASSWORD = "e2e-debug-local-only";
const DEFAULT_E2E_ADMIN_PASSWORD = "e2e-admin-local-only";

function appendNoProxy(value: string | undefined) {
  return value ? `${value},${PLAYWRIGHT_NO_PROXY}` : PLAYWRIGHT_NO_PROXY;
}

function buildPlaywrightDebugAuthEnv(env: NodeJS.ProcessEnv) {
  return {
    E2E_DEBUG_AUTH: "1",
    DEV_DEBUG_USERNAME: env.DEV_DEBUG_USERNAME ?? DEV_SEED.debugUsername,
    DEV_DEBUG_NAME: env.DEV_DEBUG_NAME ?? DEV_SEED.debugName,
    DEV_DEBUG_PASSWORD: env.DEV_DEBUG_PASSWORD ?? DEFAULT_E2E_DEBUG_PASSWORD,
    DEV_ADMIN_USERNAME: env.DEV_ADMIN_USERNAME ?? DEV_SEED.adminUsername,
    DEV_ADMIN_NAME: env.DEV_ADMIN_NAME ?? DEV_SEED.adminName,
    DEV_ADMIN_PASSWORD: env.DEV_ADMIN_PASSWORD ?? DEFAULT_E2E_ADMIN_PASSWORD,
  };
}

export function resolvePlaywrightServerRuntime(
  env: NodeJS.ProcessEnv = process.env,
) {
  const host =
    env.PLAYWRIGHT_HOST?.trim() || env.APP_HOST?.trim() || "127.0.0.1";
  const playwrightPort = parseOptionalCliInteger(env.PLAYWRIGHT_PORT, {
    min: 1,
    max: MAX_PORT,
  });
  const port =
    playwrightPort === null ? resolveAppPort(env) : String(playwrightPort);
  const baseUrl = env.APP_PUBLIC_ORIGIN?.trim() || `http://${host}:${port}`;

  return { host, port, baseUrl };
}

export function resolvePlaywrightHarnessRuntime(
  env: NodeJS.ProcessEnv = process.env,
) {
  const { host, port, baseUrl } = resolvePlaywrightServerRuntime(env);
  const isCi = Boolean(env.CI);
  const transparentArtifacts = env.E2E_TRANSPARENCY === "1";
  const retries = parseCliInteger(
    env.PLAYWRIGHT_RETRIES ?? (isCi ? "2" : "0"),
    0,
    { min: 0 },
  );
  const workers = parseCliInteger(
    env.PLAYWRIGHT_WORKERS,
    DEFAULT_PLAYWRIGHT_WORKERS,
    { min: 1 },
  );
  const webServerTimeoutMs = parseCliInteger(
    env.PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS ?? `${DEFAULT_WEB_SERVER_TIMEOUT_MS}`,
    DEFAULT_WEB_SERVER_TIMEOUT_MS,
    { min: 0 },
  );
  const reporter: ReporterDescription[] = isCi ? [["github"]] : [["list"]];
  const trace: TraceMode = transparentArtifacts ? "on" : "on-first-retry";
  const screenshot: ScreenshotMode = transparentArtifacts
    ? "on"
    : "only-on-failure";

  return {
    host,
    port,
    baseUrl,
    reuseExistingServer:
      env.PLAYWRIGHT_REUSE_SERVER === "1" ||
      (env.PLAYWRIGHT_REUSE_SERVER !== "0" && !isCi),
    retries,
    workers,
    fullyParallel: env.PLAYWRIGHT_FULLY_PARALLEL === "1",
    forbidOnly: isCi,
    reporter,
    trace,
    screenshot,
    webServerTimeoutMs,
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
  const awsRegion = resolveMinioAwsRegion(env);
  const e2eBucket = resolvePlaywrightBucketName(env);
  const credentials = resolveMinioCredentials(env);

  return Object.fromEntries(
    Object.entries({
      ...env,
      APP_HOST: options.host,
      HOSTNAME: options.host,
      PORT: options.port,
      NO_PROXY: appendNoProxy(env.NO_PROXY),
      no_proxy: appendNoProxy(env.no_proxy),
      APP_PUBLIC_ORIGIN: baseUrl,
      ...buildPlaywrightDebugAuthEnv(env),
      S3_BUCKET: e2eBucket,
      AWS_REGION: awsRegion,
      AWS_ACCESS_KEY_ID: credentials.accessKeyId,
      AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
      AWS_ENDPOINT_URL_S3: resolveMinioEndpoint(env),
    }).filter(([, value]) => value !== undefined),
  ) as Record<string, string>;
}

function replaceDirectory(source: string, target: string) {
  fs.rmSync(target, { recursive: true, force: true });
  if (!fs.existsSync(source)) {
    return;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}

export function preparePlaywrightStandaloneRuntime(root = process.cwd()) {
  const standaloneRoot = path.dirname(
    resolveStandaloneServerPath(
      root,
      "bun run test:e2e:prepare or bun run build",
    ),
  );
  const standaloneNextRoot = path.join(standaloneRoot, ".next");

  replaceDirectory(
    path.join(root, ".next", "static"),
    path.join(standaloneNextRoot, "static"),
  );
  replaceDirectory(
    path.join(root, "public"),
    path.join(standaloneRoot, "public"),
  );
}

function hasPreparedPlaywrightStandaloneRuntime(root = process.cwd()) {
  try {
    const standaloneRoot = path.dirname(
      resolveStandaloneServerPath(root, "bun run test:e2e:prepare"),
    );

    return (
      fs.existsSync(path.join(standaloneRoot, ".next", "static")) &&
      fs.existsSync(path.join(standaloneRoot, "public"))
    );
  } catch {
    return false;
  }
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

export async function provisionPlaywrightBucket(
  env: NodeJS.ProcessEnv = process.env,
) {
  const endpoint = resolveMinioEndpoint(env);
  const bucket = resolvePlaywrightBucketName(env);
  const credentials = resolveMinioCredentials(env);

  const s3 = new S3Client({
    region: resolveMinioAwsRegion(env),
    endpoint,
    forcePathStyle: true,
    credentials,
  });

  await retry(MINIO_PROVISION_ATTEMPTS, async () => {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: bucket }));
      return;
    } catch (error) {
      if (!isBucketMissingError(error)) {
        throw error;
      }
    }

    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  });

  const smokeKey = `e2e-smoke/${Date.now()}.txt`;
  await retry(MINIO_PROVISION_ATTEMPTS, async () => {
    const smokeUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: bucket,
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

export function seedPlaywrightData(env: NodeJS.ProcessEnv = process.env) {
  execSync("bun run dev:seed-scenarios", {
    env,
    stdio: "inherit",
  });
}

export async function bootstrapPlaywrightData(
  env: NodeJS.ProcessEnv = process.env,
) {
  assertPlaywrightDatabaseUrl(env);
  await provisionPlaywrightBucket(env);
  seedPlaywrightData(env);
}

export function startPlaywrightStandaloneServer(
  root = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
) {
  const runtime = resolvePlaywrightHarnessRuntime(env);
  const serverEnv = buildPlaywrightServerEnv({
    host: runtime.host,
    port: runtime.port,
    baseUrl: runtime.baseUrl,
    env,
  });

  if (!hasPreparedPlaywrightStandaloneRuntime(root)) {
    execSync("bun run test:e2e:prepare", {
      cwd: root,
      env,
      stdio: "inherit",
    });
  }

  return spawn(
    process.execPath,
    [resolveStandaloneServerPath(root, "bun run test:e2e:prepare")],
    {
      cwd: root,
      stdio: "inherit",
      env: serverEnv,
    },
  );
}
