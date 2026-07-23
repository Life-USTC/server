import { normalizeApiRoutePath } from "@/lib/log/api-observability-path";
import { logApiRequest } from "@/lib/log/app-logger";
import { getSafeErrorName } from "@/lib/log/safe-error-name";
import { writeApiRequestAnalytics } from "@/lib/metrics/analytics-engine";

export function recordApiRequestStart(input: {
  method: string;
  pathname: string;
  requestId: string;
}) {
  const route = normalizeApiRoutePath(input.pathname);

  logApiRequest(input.method, route, 0, undefined, {
    event: "request.start",
    requestId: input.requestId,
  });
}

export function recordApiRequestFinish(input: {
  authMode: string;
  ioObservedDurationMs: number;
  method: string;
  requestId: string;
  route: string;
  status: number;
}) {
  logApiRequest(
    input.method,
    input.route,
    input.status,
    input.ioObservedDurationMs,
    {
      authMode: input.authMode,
      event: "request.finish",
      requestId: input.requestId,
    },
    input.status >= 500 ? "error" : "info",
  );
  writeApiRequestAnalytics({
    authMode: input.authMode,
    event: "finish",
    ioObservedDurationMs: input.ioObservedDurationMs,
    method: input.method,
    route: input.route,
    status: input.status,
  });
}

export function recordApiRequestError(input: {
  authMode: string;
  error: unknown;
  ioObservedDurationMs: number;
  method: string;
  requestId: string;
  route: string;
}) {
  const status = 500;
  logApiRequest(
    input.method,
    input.route,
    status,
    input.ioObservedDurationMs,
    {
      authMode: input.authMode,
      errorName: getSafeErrorName(input.error),
      event: "request.error",
      requestId: input.requestId,
    },
    "error",
  );
  writeApiRequestAnalytics({
    authMode: input.authMode,
    event: "error",
    ioObservedDurationMs: input.ioObservedDurationMs,
    method: input.method,
    route: input.route,
    status,
  });
}
