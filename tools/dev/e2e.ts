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
import { getDevDebugCredentialConfig } from "./seed/dev-seed";

const PLAYWRIGHT_HOST = "127.0.0.1";
const DEFAULT_PLAYWRIGHT_PORT = "3000";
const DEFAULT_WEB_SERVER_TIMEOUT_MS = 300 * 1000;
const LOCAL_NO_PROXY = "127.0.0.1,localhost,::1";
const WRANGLER_E2E_CONFIG_PATH = path.join(
  ".wrangler",
  "tmp",
  "e2e-wrangler.json",
);
const WRANGLER_E2E_PERSIST_PATH = path.join(".wrangler", "e2e", "state");
export const E2E_WORKER_ARTIFACT_DIR = path.join("build", "e2e-worker");
const E2E_WORKER_SOURCE_ENTRIES = [
  {
    source: path.join(".svelte-kit", "cloudflare"),
    target: "cloudflare",
    kind: "directory",
  },
  {
    source: path.join(".svelte-kit", "cloudflare-tmp", "manifest.js"),
    target: path.join("cloudflare-tmp", "manifest.js"),
    kind: "file",
  },
  {
    source: path.join(".svelte-kit", "output", "server"),
    target: path.join("output", "server"),
    kind: "directory",
  },
] as const;
const E2E_WORKER_CONTRACT_FILES = [
  "_worker.js",
  path.join("cloudflare-tmp", "manifest.js"),
  path.join("output", "server", "index.js"),
] as const;
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
const E2E_REQUIRED_WORKER_VAR_KEYS = ["AUTH_SECRET"] as const;

function parseLocalPlaywrightBaseUrl(value: string) {
  const url = new URL(value);
  const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

  if (url.protocol !== "http:") {
    throw new Error(
      "PLAYWRIGHT_BASE_URL must use http because the E2E harness starts a plain local Wrangler server.",
    );
  }
  if (!loopbackHosts.has(url.hostname)) {
    throw new Error(
      "PLAYWRIGHT_BASE_URL must point to localhost or 127.0.0.1 because the E2E harness starts a local Wrangler server.",
    );
  }
  if (!url.port) {
    throw new Error(
      "PLAYWRIGHT_BASE_URL must include an explicit port for the local Wrangler server.",
    );
  }

  return url;
}

function buildPlaywrightDebugAuthEnv(env: NodeJS.ProcessEnv) {
  const credentials = getDevDebugCredentialConfig(env);

  return {
    E2E_DEBUG_AUTH: "1",
    DEV_DEBUG_USERNAME: credentials.debug.username,
    DEV_DEBUG_NAME: credentials.debug.name,
    DEV_DEBUG_EMAIL: credentials.debug.email,
    DEV_DEBUG_PASSWORD: credentials.debug.password,
    DEV_ADMIN_USERNAME: credentials.admin.username,
    DEV_ADMIN_NAME: credentials.admin.name,
    DEV_ADMIN_EMAIL: credentials.admin.email,
    DEV_ADMIN_PASSWORD: credentials.admin.password,
  };
}

export function appendLocalNoProxy(value: string | undefined) {
  return value ? `${value},${LOCAL_NO_PROXY}` : LOCAL_NO_PROXY;
}

export function resolvePlaywrightServerRuntime(
  env: NodeJS.ProcessEnv = process.env,
) {
  const baseUrlOverride = env.PLAYWRIGHT_BASE_URL;
  const parsedBaseUrl = baseUrlOverride
    ? parseLocalPlaywrightBaseUrl(baseUrlOverride)
    : undefined;
  const baseUrlPort = parsedBaseUrl?.port;
  const port = baseUrlPort || env.PLAYWRIGHT_PORT || DEFAULT_PLAYWRIGHT_PORT;

  return {
    host: PLAYWRIGHT_HOST,
    port,
    baseUrl: baseUrlOverride ?? `http://${PLAYWRIGHT_HOST}:${port}`,
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
      ...buildPlaywrightDebugAuthEnv(env),
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

function e2eWorkerArtifactPath(root: string, relativePath = "") {
  return path.join(root, E2E_WORKER_ARTIFACT_DIR, relativePath);
}

function requirePathKind(
  root: string,
  relativePath: string,
  kind: "directory" | "file",
) {
  const filePath = path.join(root, relativePath);
  const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : undefined;
  if (
    !stat ||
    (kind === "directory" && !stat.isDirectory()) ||
    (kind === "file" && !stat.isFile())
  ) {
    throw new Error(`Missing Cloudflare E2E build ${kind}: ${relativePath}`);
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

function copyE2EWorkerArtifact(root: string) {
  const artifactRoot = e2eWorkerArtifactPath(root);
  fs.rmSync(artifactRoot, { recursive: true, force: true });

  for (const entry of E2E_WORKER_SOURCE_ENTRIES) {
    requirePathKind(root, entry.source, entry.kind);
    const sourcePath = path.join(root, entry.source);
    const targetPath = e2eWorkerArtifactPath(root, entry.target);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });

    if (entry.kind === "directory") {
      fs.cpSync(sourcePath, targetPath, { recursive: true });
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }

  writeE2EWorkerEntrypoint(root);
}

function writeE2EWorkerEntrypoint(root: string) {
  const sourcePath = e2eWorkerArtifactPath(
    root,
    path.join("cloudflare", "_worker.js"),
  );
  const targetPath = e2eWorkerArtifactPath(root, "_worker.js");
  const source = fs.readFileSync(sourcePath, "utf8");
  const rewritten = source
    .replaceAll("./../output/", "./output/")
    .replaceAll("./../cloudflare-tmp/", "./cloudflare-tmp/");

  fs.writeFileSync(targetPath, rewritten);
}

export function validatePlaywrightWorkerRuntime(
  root = process.cwd(),
  commandHint = "bun run e2e:build-artifacts",
) {
  for (const relativePath of E2E_WORKER_CONTRACT_FILES) {
    const artifactRelativePath = path.join(
      E2E_WORKER_ARTIFACT_DIR,
      relativePath,
    );
    const artifactPath = path.join(root, artifactRelativePath);
    const stat = fs.existsSync(artifactPath)
      ? fs.statSync(artifactPath)
      : undefined;
    if (!stat?.isFile()) {
      throw new Error(
        `Missing E2E Worker artifact file: ${artifactRelativePath}. Run \`${commandHint}\` before starting the E2E app.`,
      );
    }
  }
}

export function preparePlaywrightWorkerRuntime(root = process.cwd()) {
  copyE2EWorkerArtifact(root);
  validatePlaywrightWorkerRuntime(root);
}

function pickE2EWorkerVars(env: Record<string, string>) {
  return Object.fromEntries(
    E2E_WORKER_VAR_KEYS.flatMap((key) => {
      const value = env[key];
      return value ? [[key, value]] : [];
    }),
  );
}

function assertE2EWorkerRuntimeEnv(
  env: Record<string, string>,
  config: {
    hyperdrive?: Array<{
      binding?: string;
    }>;
  },
) {
  const missing: string[] = E2E_REQUIRED_WORKER_VAR_KEYS.filter(
    (key) => !env[key],
  );
  const needsHyperdrive = config.hyperdrive?.some(
    (binding) => binding.binding === "HYPERDRIVE",
  );
  if (
    needsHyperdrive &&
    !env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE
  ) {
    missing.push("CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing E2E Worker environment variables: ${missing.join(", ")}. Load .env or pass DATABASE_URL and AUTH_SECRET before starting Playwright E2E.`,
    );
  }
}

export function writePlaywrightWranglerConfig(
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
    hyperdrive?: Array<{
      binding?: string;
      id?: string;
      localConnectionString?: string;
    }>;
  }>(sourceConfigPath);

  assertE2EWorkerRuntimeEnv(env, config);

  delete config.routes;
  const artifactRoot = e2eWorkerArtifactPath(root);
  config.main = path.resolve(artifactRoot, "_worker.js");
  config.assets = {
    ...config.assets,
    directory: path.resolve(artifactRoot, "cloudflare"),
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
  const hyperdriveLocalConnection =
    env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE;
  if (hyperdriveLocalConnection && config.hyperdrive) {
    config.hyperdrive = config.hyperdrive.map((binding) =>
      binding.binding === "HYPERDRIVE"
        ? { ...binding, localConnectionString: hyperdriveLocalConnection }
        : binding,
    );
  }

  fs.mkdirSync(path.dirname(targetConfigPath), { recursive: true });
  fs.writeFileSync(targetConfigPath, `${JSON.stringify(config, null, 2)}\n`);
  return targetConfigPath;
}

export async function startPlaywrightWorkerRuntime(root = process.cwd()) {
  validatePlaywrightWorkerRuntime(root);
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
