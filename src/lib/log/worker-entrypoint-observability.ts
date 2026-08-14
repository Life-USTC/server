import { logAppEvent } from "@/lib/log/app-logger";

export type EdgeRequestClass =
  | "catalog-redirect"
  | "public-not-found"
  | "public-ssr-cache";

export type EdgeCacheOutcome =
  | "bypass"
  | "dynamic"
  | "hit"
  | "miss"
  | "revalidated"
  | "stale"
  | "unknown"
  | "updating";

const SAFE_STATIC_PUBLIC_ROUTES = new Set([
  "/api-docs",
  "/guides/markdown-support",
  "/privacy",
  "/terms",
  "/usage/bot",
  "/usage/cli",
  "/usage/mcp",
  "/usage/mobile",
]);

const CATALOG_DETAIL_ROUTE = /^\/catalog\/(courses|sections|teachers)\/[^/]+$/;
const CATALOG_LIST_ROUTE = /^\/catalog\/(courses|sections|teachers)$/;
const SAFE_CACHE_OUTCOMES = new Set<EdgeCacheOutcome>([
  "bypass",
  "dynamic",
  "hit",
  "miss",
  "revalidated",
  "stale",
  "updating",
]);

export function normalizePublicSsrObservedRoute(pathname: string) {
  const detail = CATALOG_DETAIL_ROUTE.exec(pathname);
  if (detail) return `/catalog/${detail[1]}/:id`;
  if (CATALOG_LIST_ROUTE.test(pathname)) return pathname;
  if (pathname === "/api/docs" || pathname.startsWith("/api/docs/")) {
    return "/api/docs/:page";
  }
  if (SAFE_STATIC_PUBLIC_ROUTES.has(pathname)) return pathname;
  return "public-page";
}

export function resolveEdgeCacheOutcome(response: Response): EdgeCacheOutcome {
  const outcome = response.headers.get("cf-cache-status")?.toLowerCase();
  return outcome && SAFE_CACHE_OUTCOMES.has(outcome as EdgeCacheOutcome)
    ? (outcome as EdgeCacheOutcome)
    : "unknown";
}

export function observedEdgeResponse(input: {
  cacheOutcome: EdgeCacheOutcome;
  request: Request;
  requestClass: EdgeRequestClass;
  requestId: string;
  response: Response;
  route: string;
  startMs: number;
}) {
  const response = new Response(input.response.body, input.response);
  response.headers.set("x-request-id", input.requestId);
  logAppEvent(
    response.status >= 500 ? "error" : "info",
    "edge.request.finish",
    {
      cacheOutcome: input.cacheOutcome,
      event: "edge.request.finish",
      ioObservedDurationMs: Date.now() - input.startMs,
      method: input.request.method,
      requestClass: input.requestClass,
      requestId: input.requestId,
      route: input.route,
      source: "worker-entrypoint",
      status: response.status,
    },
  );
  return response;
}

export function logScheduledTaskFinish(
  task: "auth-record-cleanup" | "upload-pending-cleanup",
  counts: Record<string, number>,
) {
  logAppEvent("info", "scheduled.task.finish", {
    ...counts,
    event: "scheduled.task.finish",
    source: "worker-entrypoint",
    task,
  });
}

export function logUnknownScheduledTask() {
  logAppEvent("warn", "scheduled.task.unknown", {
    event: "scheduled.task.unknown",
    source: "worker-entrypoint",
  });
}
