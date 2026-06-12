import { emitLog } from "@/lib/log/app-log-emitter";
import {
  type AppLogContext,
  type AppLogLevel,
  baseLogPayload,
  isProductionEnvironment,
  shouldLog,
} from "@/lib/log/app-logger-core";

export { shouldLog };

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
