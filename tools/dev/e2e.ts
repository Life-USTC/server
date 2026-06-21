import { spawn } from "node:child_process";
import * as fs from "node:fs";
import path from "node:path";
import type {
  ReporterDescription,
  ScreenshotMode,
  TraceMode,
} from "@playwright/test";
import {
  flattenDiagnosticMessageText,
  parseConfigFileTextToJson,
} from "typescript";
import { DEV_SEED } from "./seed/dev-seed";

const PLAYWRIGHT_HOST = "127.0.0.1";
const DEFAULT_PLAYWRIGHT_PORT = "3000";
const DEFAULT_WEB_SERVER_TIMEOUT_MS = 300 * 1000;
const DEFAULT_E2E_DEBUG_PASSWORD = "e2e-debug-local-only";
const DEFAULT_E2E_ADMIN_PASSWORD = "e2e-admin-local-only";
const LOCAL_NO_PROXY = "127.0.0.1,localhost,::1";
const WRANGLER_E2E_CONFIG_PATH = path.join(".wrangler", "e2e", "wrangler.json");
const WRANGLER_E2E_PERSIST_PATH = path.join(".wrangler", "e2e", "state");
const E2E_WORKER_VAR_KEYS = [
  "AUTH_SECRET",
  "JWT_SECRET",
  "WEBHOOK_SECRET",
  "OAUTH_PROXY_SECRET",
  "E2E_DEBUG_AUTH",
  "DEV_DEBUG_USERNAME",
  "DEV_DEBUG_NAME",
  "DEV_DEBUG_EMAIL",
  "DEV_DEBUG_PASSWORD",
  "DEV_ADMIN_USERNAME",
  "DEV_ADMIN_NAME",
  "DEV_ADMIN_EMAIL",
  "DEV_ADMIN_PASSWORD",
  "METRICS_BEARER_TOKEN",
  "UPLOAD_TOTAL_QUOTA_MB",
] as const;

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

export function appendLocalNoProxy(value: string | undefined) {
  return value ? `${value},${LOCAL_NO_PROXY}` : LOCAL_NO_PROXY;
}

export function resolvePlaywrightServerRuntime(
  env: NodeJS.ProcessEnv = process.env,
) {
  const baseUrlOverride = env.PLAYWRIGHT_BASE_URL;
  const baseUrlPort = baseUrlOverride
    ? new URL(baseUrlOverride).port
    : undefined;
  const port = baseUrlPort || env.PLAYWRIGHT_PORT || DEFAULT_PLAYWRIGHT_PORT;
  const baseUrl = baseUrlOverride ?? `http://${PLAYWRIGHT_HOST}:${port}`;

  return {
    host: PLAYWRIGHT_HOST,
    port,
    baseUrl,
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
  const hyperdriveLocalConnection =
    env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE ??
    env.DATABASE_URL;

  const serverEnv = Object.fromEntries(
    Object.entries({
      ...env,
      HOST: options.host,
      PORT: options.port,
      ORIGIN: baseUrl,
      APP_PUBLIC_ORIGIN: baseUrl,
      CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE:
        hyperdriveLocalConnection,
      NO_PROXY: appendLocalNoProxy(env.NO_PROXY),
      no_proxy: appendLocalNoProxy(env.no_proxy),
      ...buildPlaywrightDebugAuthEnv(),
    }).filter(([, value]) => value !== undefined),
  ) as Record<string, string>;

  for (const proxyEnv of [
    "all_proxy",
    "ALL_PROXY",
    "http_proxy",
    "HTTP_PROXY",
    "https_proxy",
    "HTTPS_PROXY",
  ]) {
    delete serverEnv[proxyEnv];
  }

  if (serverEnv.FORCE_COLOR) {
    delete serverEnv.NO_COLOR;
  }

  return serverEnv;
}

function resolveWorkerEntrypoint(
  root = process.cwd(),
  commandHint = "bun run build",
) {
  const workerPath = path.join(root, ".svelte-kit", "cloudflare", "_worker.js");
  if (fs.existsSync(workerPath)) {
    return workerPath;
  }

  throw new Error(
    `Missing Cloudflare Worker bundle. Run \`${commandHint}\` before starting the E2E app.`,
  );
}

function requireBuiltFile(root: string, relativePath: string) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing Cloudflare E2E build file: ${relativePath}`);
  }
}

function readJsoncFile<T>(filePath: string): T {
  const parsed = parseConfigFileTextToJson(
    filePath,
    fs.readFileSync(filePath, "utf8"),
  );
  if (parsed.error) {
    throw new Error(
      `Invalid JSONC in ${filePath}: ${flattenDiagnosticMessageText(
        parsed.error.messageText,
        "\n",
      )}`,
    );
  }
  return parsed.config as T;
}

export function preparePlaywrightWorkerRuntime(root = process.cwd()) {
  resolveWorkerEntrypoint(root, "bun run build");
  requireBuiltFile(root, ".svelte-kit/cloudflare-tmp/manifest.js");
  requireBuiltFile(root, ".svelte-kit/output/server/index.js");
}

function pickE2EWorkerVars(env: Record<string, string>) {
  return Object.fromEntries(
    E2E_WORKER_VAR_KEYS.flatMap((key) => {
      const value = env[key];
      return value ? [[key, value]] : [];
    }),
  );
}

function writePlaywrightWranglerConfig(
  root: string,
  baseUrl: string,
  env: Record<string, string>,
) {
  const sourceConfigPath = path.join(root, "wrangler.jsonc");
  const targetConfigPath = path.join(root, WRANGLER_E2E_CONFIG_PATH);
  const config = readJsoncFile<{
    alias?: Record<string, string>;
    assets?: { directory?: string };
    main?: string;
    routes?: unknown;
    vars?: Record<string, string>;
  }>(sourceConfigPath);

  delete config.routes;
  config.main = path.resolve(root, ".svelte-kit/cloudflare/_worker.js");
  config.assets = {
    ...config.assets,
    directory: path.resolve(root, ".svelte-kit/cloudflare"),
  };
  config.vars = {
    ...config.vars,
    ...pickE2EWorkerVars(env),
    NODE_ENV: "test",
    APP_PUBLIC_ORIGIN: baseUrl,
  };
  if (config.alias) {
    config.alias = Object.fromEntries(
      Object.entries(config.alias).map(([key, value]) => [
        key,
        path.resolve(root, value),
      ]),
    );
  }

  fs.mkdirSync(path.dirname(targetConfigPath), { recursive: true });
  fs.writeFileSync(targetConfigPath, `${JSON.stringify(config, null, 2)}\n`);
  return targetConfigPath;
}

export async function startPlaywrightWorkerRuntime(root = process.cwd()) {
  preparePlaywrightWorkerRuntime(root);
  const runtime = resolvePlaywrightServerRuntime();
  const env = buildPlaywrightServerEnv({
    host: runtime.host,
    port: runtime.port,
    baseUrl: runtime.baseUrl,
  });
  const configPath = writePlaywrightWranglerConfig(root, runtime.baseUrl, env);
  const persistPath = path.join(root, WRANGLER_E2E_PERSIST_PATH);

  const child = spawn(
    "bunx",
    [
      "wrangler",
      "dev",
      "--config",
      configPath,
      "--ip",
      runtime.host,
      "--port",
      runtime.port,
      "--local",
      "--persist-to",
      persistPath,
      "--log-level",
      "info",
    ],
    {
      cwd: root,
      env,
      stdio: "inherit",
    },
  );

  const stop = (signal: NodeJS.Signals) => {
    if (!child.killed) child.kill(signal);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  await new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      if (code === 0 || signal) {
        resolve();
        return;
      }
      reject(new Error(`wrangler dev exited with code ${code}`));
    });
  });
}

export function assertPlaywrightDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
) {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for E2E global setup");
  }
}

export async function bootstrapPlaywrightData(
  env: NodeJS.ProcessEnv = process.env,
) {
  assertPlaywrightDatabaseUrl(env);
}

if (process.argv[1]?.endsWith("e2e.ts")) {
  await import("dotenv/config");

  const command = process.argv[2];

  if (command === "prepare") {
    preparePlaywrightWorkerRuntime();
  } else if (command === "start") {
    await startPlaywrightWorkerRuntime();
  } else {
    console.error("Usage: bun run tools/dev/e2e.ts <prepare|start>");
    process.exit(2);
  }
}
