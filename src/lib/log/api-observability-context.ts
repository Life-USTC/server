import { normalizeApiRoutePath } from "@/lib/log/api-observability-path";

type ApiRequestObservabilityContext = {
  requestId: string;
  startMs: number;
};

const apiRequestObservabilityContexts = new WeakMap<
  Request,
  ApiRequestObservabilityContext
>();

export function setApiRequestObservabilityContext(
  request: Request,
  context: ApiRequestObservabilityContext,
) {
  apiRequestObservabilityContexts.set(request, context);
}

function getRequestId(request: Request) {
  return (
    apiRequestObservabilityContexts.get(request)?.requestId ??
    request.headers.get("x-request-id") ??
    "unknown"
  );
}

function getRequestStartMs(request: Request) {
  const contextStartMs = apiRequestObservabilityContexts.get(request)?.startMs;
  if (contextStartMs) return contextStartMs;

  const value = Number(request.headers.get("x-request-start-ms"));
  return Number.isFinite(value) && value > 0 ? value : Date.now();
}

function inferAuthMode(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) return "bearer";

  const cookie = request.headers.get("cookie") ?? "";
  return cookie.includes("better-auth.session_token") ? "cookie" : "anonymous";
}

export function apiRequestContext(request: Request) {
  const url = new URL(request.url);
  return {
    authMode: inferAuthMode(request),
    method: request.method,
    requestId: getRequestId(request),
    route: normalizeApiRoutePath(url.pathname),
    startMs: getRequestStartMs(request),
  };
}
