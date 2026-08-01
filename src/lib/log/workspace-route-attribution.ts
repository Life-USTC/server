import { AsyncLocalStorage } from "node:async_hooks";
import { runCloudflareTraceSpan } from "@/lib/adapters/cloudflare-runtime";
import { getApiRequestObservabilityRequestId } from "@/lib/log/api-observability-context";
import { logAppEvent } from "@/lib/log/app-logger";
import { isProductionEnvironment } from "@/lib/log/app-logger-core";
import {
  type WorkspaceHomeworksRouteStage,
  type WorkspaceRouteName,
  type WorkspaceRouteStage,
  type WorkspaceSubscriptionsCurrentRouteStage,
  writeWorkspaceRouteStageAnalytics,
} from "@/lib/metrics/analytics-engine";

type WorkspaceRouteAttributionContext = {
  requestId: string | undefined;
  route: WorkspaceRouteName;
};

const workspaceRouteAttributionStorage =
  new AsyncLocalStorage<WorkspaceRouteAttributionContext>();

export function getWorkspaceRouteAttribution() {
  return workspaceRouteAttributionStorage.getStore();
}

export function runWithWorkspaceRouteAttribution<T>(
  route: WorkspaceRouteName,
  request: Request,
  work: () => Promise<T>,
): Promise<T> {
  return workspaceRouteAttributionStorage.run(
    {
      route,
      requestId: getApiRequestObservabilityRequestId(request),
    },
    work,
  );
}

function shouldLogSuccessfulWorkspaceStage(requestId: string | undefined) {
  if (!isProductionEnvironment()) return true;
  if (!requestId) return true;

  let hash = 0;
  for (let index = 0; index < requestId.length; index += 1) {
    hash = (hash * 31 + requestId.charCodeAt(index)) >>> 0;
  }
  return hash % 4 === 0;
}

function shouldLogWorkspaceStage(
  requestId: string | undefined,
  status: "error" | "success",
  ioObservedDurationMs: number,
) {
  if (status === "error") return true;
  if (ioObservedDurationMs >= 1_000) return true;
  return shouldLogSuccessfulWorkspaceStage(requestId);
}

function workspaceTraceSpanName(
  route: WorkspaceRouteName,
  stage: WorkspaceRouteStage,
) {
  if (route === "homeworks") {
    return `workspace.homeworks.${stage}`;
  }

  if (stage === "auth") {
    return "workspace.subscriptions.current.auth";
  }
  if (stage === "db_context") {
    return "workspace.subscriptions.current.db_context";
  }
  return "workspace.subscriptions.current.read";
}

function logWorkspaceRouteStage(input: {
  ioObservedDurationMs: number;
  requestId: string | undefined;
  route: WorkspaceRouteName;
  stage: WorkspaceRouteStage;
  status: "error" | "success";
}) {
  if (
    !shouldLogWorkspaceStage(
      input.requestId,
      input.status,
      input.ioObservedDurationMs,
    )
  ) {
    return;
  }

  logAppEvent(
    input.status === "error" ? "warn" : "info",
    "workspace.route.stage",
    {
      event: "workspace.route.stage",
      ioObservedDurationMs: input.ioObservedDurationMs,
      requestId: input.requestId,
      route: input.route,
      source: "api",
      stage: input.stage,
      status: input.status,
    },
  );
}

function writeWorkspaceRouteStageAnalyticsForRoute(input: {
  ioObservedDurationMs: number;
  route: WorkspaceRouteName;
  stage: WorkspaceRouteStage;
  status: "error" | "success";
}) {
  if (input.route === "homeworks") {
    writeWorkspaceRouteStageAnalytics({
      ioObservedDurationMs: input.ioObservedDurationMs,
      route: "homeworks",
      stage: input.stage as WorkspaceHomeworksRouteStage | "db_context",
      status: input.status,
    });
    return;
  }

  writeWorkspaceRouteStageAnalytics({
    ioObservedDurationMs: input.ioObservedDurationMs,
    route: "subscriptions_current",
    stage: input.stage as
      | WorkspaceSubscriptionsCurrentRouteStage
      | "db_context",
    status: input.status,
  });
}

export function recordWorkspaceRouteDbContext(ioObservedDurationMs: number) {
  const attribution = getWorkspaceRouteAttribution();
  if (!attribution) return;

  writeWorkspaceRouteStageAnalyticsForRoute({
    ioObservedDurationMs,
    route: attribution.route,
    stage: "db_context",
    status: "success",
  });
  logWorkspaceRouteStage({
    ioObservedDurationMs,
    requestId: attribution.requestId,
    route: attribution.route,
    stage: "db_context",
    status: "success",
  });
}

export async function runWorkspaceRouteStage<T>(
  route: "homeworks",
  stage: WorkspaceHomeworksRouteStage | "db_context",
  input: { request?: Request },
  work: () => Promise<T>,
): Promise<T>;
export async function runWorkspaceRouteStage<T>(
  route: "subscriptions_current",
  stage: WorkspaceSubscriptionsCurrentRouteStage | "db_context",
  input: { request?: Request },
  work: () => Promise<T>,
): Promise<T>;
export async function runWorkspaceRouteStage<T>(
  route: WorkspaceRouteName,
  stage: WorkspaceRouteStage,
  input: { request?: Request },
  work: () => Promise<T>,
): Promise<T> {
  const attribution = getWorkspaceRouteAttribution();
  const requestId =
    attribution?.requestId ??
    (input.request
      ? getApiRequestObservabilityRequestId(input.request)
      : undefined);
  const startMs = Date.now();

  try {
    const result = await runCloudflareTraceSpan(
      workspaceTraceSpanName(route, stage),
      {},
      work,
    );
    const ioObservedDurationMs = Date.now() - startMs;
    writeWorkspaceRouteStageAnalyticsForRoute({
      ioObservedDurationMs,
      route,
      stage,
      status: "success",
    });
    logWorkspaceRouteStage({
      ioObservedDurationMs,
      requestId,
      route,
      stage,
      status: "success",
    });
    return result;
  } catch (error) {
    const ioObservedDurationMs = Date.now() - startMs;
    writeWorkspaceRouteStageAnalyticsForRoute({
      ioObservedDurationMs,
      route,
      stage,
      status: "error",
    });
    logWorkspaceRouteStage({
      ioObservedDurationMs,
      requestId,
      route,
      stage,
      status: "error",
    });
    throw error;
  }
}
