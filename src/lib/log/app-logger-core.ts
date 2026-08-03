import { getOptionalTrimmedEnv } from "@/app-env";
import { getSafeErrorName } from "@/lib/log/safe-error-name";
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

const PRISMA_ERROR_CODE_PATTERN = /^P\d{4}$/;

/**
 * Prisma error codes are stable, documented identifiers with no request data in
 * them, so they are safe to keep in production where the message is not.
 * Without the code a production `PrismaClientKnownRequestError` is undiagnosable.
 */
function safePrismaErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }
  const { code } = error as { code: unknown };
  return typeof code === "string" && PRISMA_ERROR_CODE_PATTERN.test(code)
    ? code
    : undefined;
}

export function serializeError(error: unknown) {
  if (!error) return undefined;

  if (isProductionEnvironment()) {
    const code = safePrismaErrorCode(error);
    return { name: getSafeErrorName(error), ...(code ? { code } : {}) };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {}),
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
