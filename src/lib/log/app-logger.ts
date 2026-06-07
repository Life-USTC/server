import { getOptionalTrimmedEnv } from "@/env";
import { formatShanghaiTimestamp } from "@/lib/time/shanghai-format";

const LOG_LEVEL_ORDER = ["debug", "info", "warn", "error"] as const;
type AppLogLevel = (typeof LOG_LEVEL_ORDER)[number];
const DEFAULT_LOG_LEVEL: AppLogLevel = "info";
const LOG_LEVEL_INDEX = Object.fromEntries(
  LOG_LEVEL_ORDER.map((level, index) => [level, index]),
) as Record<AppLogLevel, number>;

type AppLogContext = Record<string, unknown>;

let fileLogFailureReported = false;

function getRuntimeEnvironment() {
  return process.env.NODE_ENV ?? "development";
}

function isProductionEnvironment() {
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

function serializeError(error: unknown) {
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

function getLogMethod(level: AppLogLevel) {
  if (level === "error") return console.error;
  if (level === "warn") return console.warn;
  if (level === "debug") return console.debug;
  return console.info;
}

function baseLogPayload() {
  return {
    timestamp: formatShanghaiTimestamp(new Date()),
    environment: getRuntimeEnvironment(),
  };
}

function getLogFileDate() {
  return new Date().toISOString().slice(0, 10);
}

function writeLogFileLine(payload: Record<string, unknown>) {
  if (typeof window !== "undefined") return;

  const logDir = getOptionalTrimmedEnv("APP_LOG_DIR");
  if (!logDir) return;

  try {
    const fs = process.getBuiltinModule("fs");
    const path = process.getBuiltinModule("path");
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(
      path.join(logDir, `app-${getLogFileDate()}.log`),
      `${JSON.stringify(payload)}\n`,
      "utf8",
    );
  } catch (error) {
    if (fileLogFailureReported) return;
    fileLogFailureReported = true;
    console.error(
      JSON.stringify({
        prefix: "[app]",
        ...baseLogPayload(),
        runtime: "server",
        message: "app.log_file_write_failed",
        error: serializeError(error),
      }),
    );
  }
}

function emitLog(
  prefix: string,
  level: AppLogLevel,
  payload: Record<string, unknown>,
  error?: unknown,
) {
  const method = getLogMethod(level);
  const serializedError = serializeError(error);

  if (isProductionEnvironment()) {
    const logObj = {
      prefix,
      ...payload,
      ...(serializedError ? { error: serializedError } : {}),
    };
    method(JSON.stringify(logObj));
    writeLogFileLine(logObj);
    return;
  }

  writeLogFileLine({
    prefix,
    ...payload,
    ...(serializedError ? { error: serializedError } : {}),
  });

  if (serializedError) {
    method(prefix, payload, serializedError);
  } else {
    method(prefix, payload);
  }
}

export function logAppEvent(
  level: AppLogLevel,
  message: string,
  context: AppLogContext = {},
  error?: unknown,
) {
  if (!shouldLog(level)) return;

  const payload = {
    ...baseLogPayload(),
    runtime: typeof window === "undefined" ? "server" : "client",
    message,
    ...context,
  };

  emitLog("[app]", level, payload, error);
}

export function logApiRequest(
  method: string,
  path: string,
  status: number,
  durationMs: number,
  context: AppLogContext = {},
) {
  if (!shouldLog("info")) return;

  const payload = {
    ...baseLogPayload(),
    method,
    path,
    status,
    durationMs,
    ...context,
  };

  emitLog("[api]", "info", payload);
}

export function logRouteFailure(
  message: string,
  status: number,
  error: unknown,
  context: AppLogContext = {},
) {
  if (status < 500 && isProductionEnvironment()) {
    return;
  }
  logAppEvent(
    status >= 500 ? "error" : "warn",
    message,
    { status, ...context },
    error,
  );
}

export function logServerActionError(
  message: string,
  error: unknown,
  context: AppLogContext = {},
) {
  logAppEvent("error", message, { source: "server-action", ...context }, error);
}

export function logClientError(
  message: string,
  error: unknown,
  context: AppLogContext = {},
) {
  logAppEvent("warn", message, { source: "client", ...context }, error);
}
