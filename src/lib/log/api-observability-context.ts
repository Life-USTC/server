import { normalizeApiRoutePath } from "@/lib/log/api-observability-path";

type ApiRequestObservabilityContext = {
  completed: boolean;
  requestId: string;
  startMs: number;
};

const apiRequestObservabilityContexts = new WeakMap<
  Request,
  ApiRequestObservabilityContext
>();

export function setApiRequestObservabilityContext(
  request: Request,
  context: Omit<ApiRequestObservabilityContext, "completed">,
) {
  apiRequestObservabilityContexts.set(request, {
    ...context,
    completed: false,
  });
}

function getRequestId(request: Request) {
  return (
    apiRequestObservabilityContexts.get(request)?.requestId ??
    crypto.randomUUID()
  );
}

function getRequestStartMs(request: Request) {
  const contextStartMs = apiRequestObservabilityContexts.get(request)?.startMs;
  if (contextStartMs) return contextStartMs;
  return Date.now();
}

function inferAuthMode(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) return "bearer";

  const cookie = request.headers.get("cookie") ?? "";
  return cookie.includes("better-auth.session_token") ? "cookie" : "anonymous";
}

export function getApiRequestObservabilityRequestId(request: Request) {
  return apiRequestObservabilityContexts.get(request)?.requestId;
}

function getOrCreateApiRequestContext(request: Request) {
  const existing = apiRequestObservabilityContexts.get(request);
  if (existing) return existing;

  const context: ApiRequestObservabilityContext = {
    completed: false,
    requestId: getRequestId(request),
    startMs: getRequestStartMs(request),
  };
  apiRequestObservabilityContexts.set(request, context);
  return context;
}

export function apiRequestContext(request: Request) {
  const url = new URL(request.url);
  const context = getOrCreateApiRequestContext(request);
  return {
    authMode: inferAuthMode(request),
    method: request.method,
    requestId: context.requestId,
    route: normalizeApiRoutePath(url.pathname),
    startMs: context.startMs,
  };
}

export function completeApiRequestContext(request: Request) {
  const stored = getOrCreateApiRequestContext(request);
  if (stored.completed) return undefined;

  stored.completed = true;
  return apiRequestContext(request);
}
