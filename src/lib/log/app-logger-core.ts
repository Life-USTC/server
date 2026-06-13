import { getOptionalTrimmedEnv } from "@/app-env";
import { formatShanghaiTimestamp } from "@/lib/time/shanghai-format";

export const LOG_LEVEL_ORDER = ["debug", "info", "warn", "error"] as const;
export type AppLogLevel = (typeof LOG_LEVEL_ORDER)[number];
export type AppLogContext = Record<string, unknown>;

const DEFAULT_LOG_LEVEL: AppLogLevel = "info";
const LOG_LEVEL_INDEX = Object.fromEntries(
  LOG_LEVEL_ORDER.map((level, index) => [level, index]),
) as Record<AppLogLevel, number>;

export function getRuntimeEnvironment() {
  return getOptionalTrimmedEnv("NODE_ENV") ?? "development";
}

export function isProductionEnvironment() {
  return getRuntimeEnvironment() === "production";
}

function parseConfiguredLogLevel(): AppLogLevel {
  const configured = getOptionalTrimmedEnv("LOG_LEVEL")?.toLowerCase();
  return configured && Object.hasOwn(LOG_LEVEL_INDEX, configured)
    ? (configured as AppLogLevel)
    : DEFAULT_LOG_LEVEL;
}

export function shouldLog(level: AppLogLevel): boolean {
  return LOG_LEVEL_INDEX[level] >= LOG_LEVEL_INDEX[parseConfiguredLogLevel()];
}

export function serializeError(error: unknown) {
  if (!error) return undefined;

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(!isProductionEnvironment() && error.stack
        ? { stack: error.stack }
        : {}),
    };
  }

  return { error };
}

export function getLogMethod(level: AppLogLevel) {
  if (level === "error") return console.error;
  if (level === "warn") return console.warn;
  if (level === "debug") return console.debug;
  return console.info;
}

export function baseLogPayload() {
  return {
    timestamp: formatShanghaiTimestamp(new Date()),
    environment: getRuntimeEnvironment(),
  };
}
