import { logApiRequest } from "@/lib/log/app-logger";
import {
  incrementCounter,
  observeDurationMs,
} from "@/lib/metrics/runtime-metrics";

const UUID_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_SEGMENT = /^\d+$/;
const OPAQUE_ID_SEGMENT = /^(?=.*\d)[A-Za-z0-9_-]{16,}$/;
const OBSERVABILITY_PATHS = new Set(["/api/metrics"]);

export function shouldObserveApiPath(pathname: string) {
  return !OBSERVABILITY_PATHS.has(pathname);
}

export function normalizeApiRoutePath(pathname: string) {
  return pathname
    .split("/")
    .map((segment) => {
      if (NUMERIC_SEGMENT.test(segment)) return ":id";
      if (UUID_SEGMENT.test(segment)) return ":id";
      if (OPAQUE_ID_SEGMENT.test(segment)) return ":id";
      return segment;
    })
    .join("/");
}

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

type ApiRouteHandler<TRequest extends Request, TArgs extends unknown[]> = (
  request: TRequest,
  ...args: TArgs
) => Response | Promise<Response>;

function getRequestId(request: Request) {
  return request.headers.get("x-request-id") ?? "unknown";
}

function getRequestStartMs(request: Request) {
  const value = Number(request.headers.get("x-request-start-ms"));
  return Number.isFinite(value) && value > 0 ? value : Date.now();
}

function inferAuthMode(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) return "bearer";

  const cookie = request.headers.get("cookie") ?? "";
  return cookie.includes("better-auth.session_token") ? "cookie" : "anonymous";
}

function apiRequestContext(request: Request) {
  const url = new URL(request.url);
  return {
    authMode: inferAuthMode(request),
    method: request.method,
    requestId: getRequestId(request),
    route: normalizeApiRoutePath(url.pathname),
    startMs: getRequestStartMs(request),
  };
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

export function observedApiRoute<
  TRequest extends Request,
  TArgs extends unknown[],
>(handler: ApiRouteHandler<TRequest, TArgs>): ApiRouteHandler<TRequest, TArgs> {
  return async (request, ...args) => {
    const context = apiRequestContext(request);

    try {
      const response = await handler(request, ...args);
      recordApiRequestFinish({
        ...context,
        durationMs: Date.now() - context.startMs,
        status: response.status,
      });
      return response;
    } catch (error) {
      recordApiRequestError({
        ...context,
        durationMs: Date.now() - context.startMs,
        error,
      });
      throw error;
    }
  };
}
