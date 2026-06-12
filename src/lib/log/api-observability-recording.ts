import {
  normalizeApiRoutePath,
  shouldObserveApiPath,
} from "@/lib/log/api-observability-path";
import { logApiRequest } from "@/lib/log/app-logger";
import {
  incrementCounter,
  observeDurationMs,
} from "@/lib/metrics/runtime-metrics";

export function recordApiRequestStart(input: {
  method: string;
  pathname: string;
  requestId: string;
}) {
  if (!shouldObserveApiPath(input.pathname)) return;

  const route = normalizeApiRoutePath(input.pathname);

  logApiRequest(input.method, route, 0, 0, {
    event: "request.start",
    requestId: input.requestId,
  });
  incrementCounter("life_ustc_api_requests_started_total", {
    method: input.method,
    route,
  });
}

export function recordApiRequestFinish(input: {
  authMode: string;
  durationMs: number;
  method: string;
  requestId: string;
  route: string;
  status: number;
}) {
  if (!shouldObserveApiPath(input.route)) return;

  logApiRequest(input.method, input.route, input.status, input.durationMs, {
    authMode: input.authMode,
    event: "request.finish",
    requestId: input.requestId,
  });
  incrementCounter("life_ustc_api_requests_total", {
    auth_mode: input.authMode,
    method: input.method,
    route: input.route,
    status: input.status,
  });
  observeDurationMs("life_ustc_api_request_duration_ms", input.durationMs, {
    method: input.method,
    route: input.route,
  });
  if (input.status >= 400) {
    incrementCounter("life_ustc_api_errors_total", {
      method: input.method,
      route: input.route,
      status: input.status,
    });
  }
}

export function recordApiRequestError(input: {
  authMode: string;
  durationMs: number;
  error: unknown;
  method: string;
  requestId: string;
  route: string;
}) {
  if (!shouldObserveApiPath(input.route)) return;

  const status = 500;
  logApiRequest(input.method, input.route, status, input.durationMs, {
    authMode: input.authMode,
    errorName: input.error instanceof Error ? input.error.name : "unknown",
    event: "request.error",
    requestId: input.requestId,
  });
  incrementCounter("life_ustc_api_requests_total", {
    auth_mode: input.authMode,
    method: input.method,
    route: input.route,
    status,
  });
  incrementCounter("life_ustc_api_errors_total", {
    method: input.method,
    route: input.route,
    status,
  });
  observeDurationMs("life_ustc_api_request_duration_ms", input.durationMs, {
    method: input.method,
    route: input.route,
  });
}
