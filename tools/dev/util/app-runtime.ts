import { existsSync } from "node:fs";
import path from "node:path";
import { parseCliInteger } from "./cli-numbers";

const DEFAULT_APP_PORT = 3000;
const MAX_PORT = 65_535;

function configuredValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function resolveAppHost(env: NodeJS.ProcessEnv = process.env) {
  return (
    configuredValue(env.APP_HOST) ??
    configuredValue(env.HOSTNAME) ??
    "127.0.0.1"
  );
}

export function resolveAppPort(env: NodeJS.ProcessEnv = process.env) {
  return String(
    parseCliInteger(env.PORT, DEFAULT_APP_PORT, { min: 1, max: MAX_PORT }),
  );
}

export function resolveHealthcheckUrl(env: NodeJS.ProcessEnv = process.env) {
  return (
    configuredValue(env.HEALTHCHECK_URL) ??
    `http://127.0.0.1:${resolveAppPort(env)}/`
  );
}

export function resolveStandaloneServerPath(
  root = process.cwd(),
  commandHint = "bun run build",
) {
  const rootServerPath = path.join(root, "server.js");
  if (existsSync(rootServerPath)) {
    return rootServerPath;
  }

  const standaloneServerPath = path.join(
    root,
    ".next",
    "standalone",
    "server.js",
  );
  if (existsSync(standaloneServerPath)) {
    return standaloneServerPath;
  }

  throw new Error(
    `Missing standalone server.js. Run \`${commandHint}\` before starting the standalone app.`,
  );
}
