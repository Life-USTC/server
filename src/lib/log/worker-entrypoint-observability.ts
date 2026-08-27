import { logAppEvent } from "@/lib/log/app-logger";
import { elapsedMs } from "@/lib/log/observability-clock";
import { shouldLogSuccessfulRequest } from "@/lib/log/request-log-sampling";
import { writeWorkerRequestAnalytics } from "@/lib/metrics/analytics-engine";

export const INTERNAL_REQUEST_ID_HEADER = "x-life-ustc-request-id";
const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EdgeRequestClass =
  | "catalog-redirect"
  | "dynamic"
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

export type WorkerQueue = "audit" | "calendar" | "unknown";

export function resolveWorkerQueue(queue: string): WorkerQueue {
  if (queue === "life-ustc-audit-log-write") return "audit";
  if (queue === "life-ustc-calendar-export-rebuild") return "calendar";
  return "unknown";
}

export function getTrustedRequestId(request: Request) {
  const requestId = request.headers.get(INTERNAL_REQUEST_ID_HEADER);
  return requestId && REQUEST_ID_PATTERN.test(requestId)
    ? requestId
    : undefined;
}

export function setTrustedRequestIdHeader(headers: Headers, requestId: string) {
  headers.delete("x-request-id");
  headers.delete(INTERNAL_REQUEST_ID_HEADER);
  headers.set(INTERNAL_REQUEST_ID_HEADER, requestId);
}

export function normalizePublicSsrObservedRoute(pathname: string) {
  if (pathname === "/account/sign-in") return "/account/sign-in";
  const detail = CATALOG_DETAIL_ROUTE.exec(pathname);
  if (detail) return `/catalog/${detail[1]}/:id`;
  if (CATALOG_LIST_ROUTE.test(pathname)) return pathname;
  if (pathname === "/api/docs" || pathname.startsWith("/api/docs/")) {
    return "/api/docs/:page";
  }
  if (SAFE_STATIC_PUBLIC_ROUTES.has(pathname)) return pathname;
  return "public-page";
}

/**
 * The dynamic Worker branch uses the same bounded route vocabulary as the
 * public branch. Keep this helper separate so that its caller makes the
 * dynamic-vs-cache attribution explicit without ever retaining path IDs.
 */
export function normalizeWorkerObservedRoute(pathname: string) {
  return normalizePublicSsrObservedRoute(pathname);
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
  const ioObservedDurationMs = elapsedMs(input.startMs);
  writeWorkerRequestAnalytics({
    cacheOutcome: input.cacheOutcome,
    durationMs: ioObservedDurationMs,
    method: input.request.method,
    requestClass: input.requestClass,
    route: input.route,
    status: response.status,
  });
  if (
    !shouldLogSuccessfulRequest({
      durationMs: ioObservedDurationMs,
      requestId: input.requestId,
      samplePercent: 10,
      status: response.status,
    })
  ) {
    return response;
  }
  logAppEvent(
    response.status >= 500 ? "error" : "info",
    "edge.request.finish",
    {
      cacheOutcome: input.cacheOutcome,
      event: "edge.request.finish",
      ioObservedDurationMs,
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

export function logWorkerFetchError(input: {
  error: unknown;
  ioObservedDurationMs: number;
  requestId: string;
}) {
  logAppEvent(
    "error",
    "worker.fetch.error",
    {
      event: "worker.fetch.error",
      ioObservedDurationMs: input.ioObservedDurationMs,
      outcome: "error",
      requestId: input.requestId,
      source: "worker-entrypoint",
    },
    input.error,
  );
}

export function logWorkerQueueFinish(input: {
  ioObservedDurationMs: number;
  messageCount: number;
  queue: Exclude<WorkerQueue, "unknown">;
}) {
  logAppEvent("info", "worker.queue.finish", {
    event: "worker.queue.finish",
    ioObservedDurationMs: input.ioObservedDurationMs,
    messageCount: input.messageCount,
    outcome: "success",
    queue: input.queue,
    source: "worker-entrypoint",
  });
}

export function logWorkerQueueError(input: {
  error: unknown;
  ioObservedDurationMs: number;
  messageCount: number;
  queue: WorkerQueue;
}) {
  logAppEvent(
    "error",
    "worker.queue.error",
    {
      event: "worker.queue.error",
      ioObservedDurationMs: input.ioObservedDurationMs,
      messageCount: input.messageCount,
      outcome: "error",
      queue: input.queue,
      source: "worker-entrypoint",
    },
    input.error,
  );
}

type ScheduledTask =
  | "auth-and-audit-retention"
  | "auth-record-cleanup"
  | "upload-pending-cleanup";

export function logScheduledTaskFinish(
  task: ScheduledTask,
  counts: Record<string, number>,
  ioObservedDurationMs?: number,
) {
  logAppEvent("info", "scheduled.task.finish", {
    ...counts,
    event: "scheduled.task.finish",
    ...(ioObservedDurationMs === undefined ? {} : { ioObservedDurationMs }),
    outcome: "success",
    source: "worker-entrypoint",
    task,
  });
}

export function logScheduledTaskError(
  task: ScheduledTask | "unknown",
  ioObservedDurationMs: number,
  error: unknown,
) {
  logAppEvent(
    "error",
    "scheduled.task.error",
    {
      event: "scheduled.task.error",
      ioObservedDurationMs,
      outcome: "error",
      source: "worker-entrypoint",
      task,
    },
    error,
  );
}

export function logUnknownScheduledTask(ioObservedDurationMs?: number) {
  logAppEvent("warn", "scheduled.task.unknown", {
    event: "scheduled.task.unknown",
    ...(ioObservedDurationMs === undefined ? {} : { ioObservedDurationMs }),
    outcome: "unknown",
    source: "worker-entrypoint",
  });
}
