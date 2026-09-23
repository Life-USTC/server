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
const SQLSTATE_CODE_PATTERN = /^[0-9A-Z]{5}$/;
const SAFE_DATABASE_CODE_KEYS = [
  "code",
  "driverCode",
  "originalCode",
  "sqlState",
  "sqlstate",
] as const;

type SafeDatabaseErrorDetails = {
  code?: string;
  prismaCode?: string;
};

function readProperty(value: object, key: string): unknown {
  try {
    return Reflect.get(value, key);
  } catch {
    return undefined;
  }
}

function readSafeDatabaseCode(value: unknown) {
  if (typeof value !== "string") return undefined;
  if (SQLSTATE_CODE_PATTERN.test(value)) return value;
  if (PRISMA_ERROR_CODE_PATTERN.test(value)) return value;
  return undefined;
}

function collectSafeDatabaseErrorDetails(
  error: unknown,
  details: SafeDatabaseErrorDetails,
  ancestors: WeakSet<object>,
  depth: number,
) {
  if (
    depth > 8 ||
    typeof error !== "object" ||
    error === null ||
    ancestors.has(error)
  ) {
    return;
  }

  ancestors.add(error);
  try {
    for (const key of SAFE_DATABASE_CODE_KEYS) {
      const code = readSafeDatabaseCode(readProperty(error, key));
      if (!code) continue;
      if (PRISMA_ERROR_CODE_PATTERN.test(code)) {
        details.prismaCode ??= code;
      } else {
        details.code ??= code;
      }
    }

    for (const key of ["meta", "cause"] as const) {
      collectSafeDatabaseErrorDetails(
        readProperty(error, key),
        details,
        ancestors,
        depth + 1,
      );
    }
  } finally {
    ancestors.delete(error);
  }
}

export function getSafeDatabaseErrorDetails(
  error: unknown,
): SafeDatabaseErrorDetails {
  const details: SafeDatabaseErrorDetails = {};
  collectSafeDatabaseErrorDetails(error, details, new WeakSet(), 0);
  return details;
}

/**
 * Prisma `P####` codes and PostgreSQL SQLSTATE codes are stable, documented
 * identifiers with no request data in them, so they are safe to keep in
 * production where the message is not. Without the code a production
 * permission or constraint failure is undiagnosable.
 *
 * Walk `cause` / Prisma `meta` because driver-adapter failures often nest the
 * real SQLSTATE under the top-level Prisma wrapper.
 */
export function getSafeDatabaseErrorCode(error: unknown): string | undefined {
  const details = getSafeDatabaseErrorDetails(error);
  return details.code ?? details.prismaCode;
}

const SAFE_LOG_MAX_DEPTH = 12;
const SAFE_LOG_MAX_KEYS = 256;

function safeLogValue(
  value: unknown,
  ancestors: WeakSet<object>,
  depth: number,
): unknown {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return "[BigInt]";
  if (typeof value === "undefined") return undefined;
  if (typeof value === "function") return "[Function]";
  if (typeof value === "symbol") return "[Symbol]";
  if (depth >= SAFE_LOG_MAX_DEPTH) return "[MaxDepth]";
  if (typeof value !== "object") return "[Unserializable]";
  if (ancestors.has(value)) return "[Circular]";

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const output = [] as unknown[];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(
          value,
          String(index),
        );
        output.push(
          descriptor && "value" in descriptor
            ? safeLogValue(descriptor.value, ancestors, depth + 1)
            : "[Unserializable]",
        );
      }
      return output;
    }

    const output = Object.create(null) as Record<string, unknown>;
    for (const key of Object.keys(value).slice(0, SAFE_LOG_MAX_KEYS)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor)) {
        output[key] = "[Unserializable]";
        continue;
      }
      output[key] = safeLogValue(descriptor.value, ancestors, depth + 1);
    }
    return output;
  } catch {
    return "[Unserializable]";
  } finally {
    ancestors.delete(value);
  }
}

export function safeJsonStringify(value: unknown, fallback: string) {
  try {
    const sanitized = safeLogValue(value, new WeakSet(), 0);
    const serialized = JSON.stringify(sanitized);
    return serialized === undefined ? fallback : serialized;
  } catch {
    return fallback;
  }
}

export function serializeError(error: unknown) {
  if (error === undefined || error === null) return undefined;

  if (isProductionEnvironment()) {
    const details = getSafeDatabaseErrorDetails(error);
    const name = (() => {
      try {
        return getSafeErrorName(error);
      } catch {
        return "UnknownError";
      }
    })();
    return {
      name,
      ...(details.code ? { code: details.code } : {}),
      ...(details.prismaCode ? { prismaCode: details.prismaCode } : {}),
    };
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
