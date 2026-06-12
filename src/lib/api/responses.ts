import { logRouteFailure } from "@/lib/log/app-logger";
import { serializeDatesDeep } from "@/lib/time/serialize-date-output";

export function handleRouteError(
  message: string,
  error: unknown,
  status = 500,
) {
  logRouteFailure(message, status, error, { source: "route-handler" });
  return errorResponse(message, status);
}

export function errorResponse(message: string, status: number) {
  return jsonResponse({ error: message }, { status });
}

export function jsonResponse(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }

  return new Response(JSON.stringify(serializeDatesDeep(body)), {
    ...init,
    headers,
  });
}

export function getRequestSearchParams(request: Request) {
  return new URL(request.url).searchParams;
}

export function badRequest(message: string) {
  return errorResponse(message, 400);
}

export function unauthorized(message = "Unauthorized") {
  return errorResponse(message, 401);
}

export function forbidden(message = "Forbidden") {
  return errorResponse(message, 403);
}

export function suspensionForbidden(reason?: string | null) {
  return jsonResponse(
    { error: "Suspended", reason: reason ?? null },
    { status: 403 },
  );
}

export function notFound(message = "Not found") {
  return errorResponse(message, 404);
}

export function payloadTooLarge(message = "Payload too large") {
  return errorResponse(message, 413);
}

export function invalidParamResponse(paramName: string) {
  return badRequest(`Invalid ${paramName}`);
}
