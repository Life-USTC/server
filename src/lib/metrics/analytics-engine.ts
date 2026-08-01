import type { AppLocale } from "@/i18n/config";
import { getCloudflareAnalyticsEngineDataset } from "@/lib/adapters/cloudflare-runtime";
import type {
  McpRequestSummary,
  McpResponsePhase,
} from "@/lib/mcp/observability-types";

type ApiRequestAnalyticsInput = {
  authMode: string;
  event: "finish" | "error";
  ioObservedDurationMs: number;
  method: string;
  route: string;
  status: number;
};

type PageRequestAnalyticsInput = {
  appIoObservedDurationMs: number;
  authIoObservedDurationMs: number;
  authMode: "anonymous" | "authenticated";
  authSignalPresence: "absent" | "present";
  catalogDetailTab: string;
  event: "finish" | "error";
  ioObservedDurationMs: number;
  locale: string;
  method: string;
  responseBytes?: number;
  route: string;
  ssrClass: "dynamic-ssr" | "public-ssr";
  status: number;
};

type McpTransportAnalyticsInput = {
  errorName?: string;
  ioObservedDurationMs: number;
  method: string;
  path: string;
  phase: McpResponsePhase;
  rpcSummary: McpRequestSummary | null;
  status: number;
  toolCount?: number;
};

type OAuthEventAnalyticsInput = {
  errorName?: string;
  event: string;
  grantType?: string | null;
  hasResource?: boolean;
  method?: string;
  path?: string;
  phase?: string;
  resourceCount?: number;
  scopeCount?: number;
  status?: number;
  statusReason?: string;
  ioObservedDurationMs: number;
};

type AuditWriteAnalyticsInput = {
  action: string;
  event: "success" | "error";
  ioObservedDurationMs: number;
  targetType?: string;
};

type StorageOperationAnalyticsInput = {
  event: "success" | "error" | "miss";
  ioObservedDurationMs: number;
  operation: "delete" | "get" | "head" | "put";
  size?: number | null;
};

export type PublicRuntimeCacheAnalyticsNamespace =
  | "api:metadata"
  | "api:semesters"
  | "sitemap"
  | `page:section-detail:overview:${AppLocale}`
  | `search:catalog:${AppLocale}`
  | `search:catalog:v2:${AppLocale}`
  | `bus:timetable:${AppLocale}`
  | `${
      | "api:courses"
      | "api:courses-list"
      | "api:sections"
      | "api:sections-list"
      | "api:teachers"
      | "api:teachers-list"
      | "page:course-detail"
      | "page:course-list"
      | "page:courses-list"
      | "page:section-detail"
      | "page:section-list"
      | "page:sections-list"
      | "page:teacher-detail"
      | "page:teacher-list"
      | "page:teachers-list"}:${AppLocale}`;

export type PublicRuntimeCacheAnalyticsReason =
  | "cache_put_rejected"
  | "none"
  | "response_build_failed"
  | "result_invalid"
  | "scheduler_unavailable"
  | "task_scheduling_failed";

type CacheEventAnalyticsInput = {
  event:
    | "colo_hit"
    | "colo_miss"
    | "colo_read_error"
    | "colo_write_complete"
    | "colo_write_error"
    | "colo_write_skip"
    | "hit"
    | "kv_hit"
    | "kv_miss"
    | "kv_read_error"
    | "kv_write_complete"
    | "kv_write_error"
    | "kv_write_skip"
    | "load_error"
    | "load_success"
    | "miss";
  ioObservedDurationMs: number;
  namespace: PublicRuntimeCacheAnalyticsNamespace;
  reason?: PublicRuntimeCacheAnalyticsReason;
  storeSize: number;
  ttlMs: number;
};

type CalendarFeedCacheAnalyticsInput = {
  feed: "user";
  status:
    | "fresh"
    | "miss"
    | "refresh_error"
    | "refresh_success"
    | "stale"
    | "store_error";
  storeSize: number;
  ttlMs: number;
};

type GraphqlOperationAnalyticsInput = {
  authMode: string;
  errorCount: number;
  estimatedCost: number;
  internalErrorCount: number;
  ioObservedDurationMs: number;
  operationName: string;
  operationType: string;
  requestId: string;
  topLevelFieldCount: number;
};

type DatabaseEventAnalyticsInput = {
  errorName: string;
  event: "connection_error" | "pool_error";
};

export type WorkspaceOverviewStage =
  | "counts"
  | "due_todo_count"
  | "due_todo_sample"
  | "item_state"
  | "lists"
  | "todo_summary"
  | "user_sections";

export type WorkspaceRouteName = "homeworks" | "subscriptions_current";

export type WorkspaceHomeworksRouteStage =
  | "audit"
  | "auth"
  | "item_state"
  | "read"
  | "section_ids"
  | "viewer";

export type WorkspaceSubscriptionsCurrentRouteStage = "auth" | "read";

export type WorkspaceRouteStage =
  | "db_context"
  | WorkspaceHomeworksRouteStage
  | WorkspaceSubscriptionsCurrentRouteStage;

type WorkspaceOverviewStageAnalyticsInput = {
  ioObservedDurationMs: number;
  stage: WorkspaceOverviewStage;
  status: "error" | "success";
};

type WorkspaceRouteStageAnalyticsInput =
  | {
      ioObservedDurationMs: number;
      route: "homeworks";
      stage: WorkspaceHomeworksRouteStage | "db_context";
      status: "error" | "success";
    }
  | {
      ioObservedDurationMs: number;
      route: "subscriptions_current";
      stage: WorkspaceSubscriptionsCurrentRouteStage | "db_context";
      status: "error" | "success";
    };

function statusClass(status: number) {
  if (!Number.isFinite(status)) return "unknown";
  return `${Math.floor(status / 100)}xx`;
}

function boundedValue(value: unknown) {
  if (value === undefined || value === null) return "unknown";
  return String(value).replaceAll("\n", " ").slice(0, 120) || "unknown";
}

function boundedList(values: string[] | undefined) {
  if (!values || values.length === 0) return "none";
  return values.slice(0, 8).map(boundedValue).join(",");
}

function finiteNumber(value: number | undefined | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function writeAnalyticsDataPoint(input: {
  blobs: string[];
  doubles: number[];
  indexes: string[];
}) {
  const dataset = getCloudflareAnalyticsEngineDataset();
  if (!dataset) return;

  try {
    dataset.writeDataPoint({
      indexes: input.indexes.map(boundedValue),
      blobs: input.blobs.map(boundedValue),
      doubles: input.doubles.map(finiteNumber),
    });
  } catch {
    // Analytics Engine must never affect the user-facing request path.
  }
}

export function writeApiRequestAnalytics(input: ApiRequestAnalyticsInput) {
  writeAnalyticsDataPoint({
    indexes: [boundedValue(input.route)],
    blobs: [
      "api_request_v2",
      input.event,
      boundedValue(input.method),
      boundedValue(input.route),
      String(input.status),
      statusClass(input.status),
      boundedValue(input.authMode),
    ],
    doubles: [input.ioObservedDurationMs, input.status],
  });
}

export function writePageRequestAnalytics(input: PageRequestAnalyticsInput) {
  const hasResponseBytes = input.responseBytes !== undefined;
  writeAnalyticsDataPoint({
    indexes: [`page:${boundedValue(input.route)}`],
    blobs: [
      "page_request_v2",
      input.event,
      boundedValue(input.route),
      boundedValue(input.method),
      String(input.status),
      statusClass(input.status),
      boundedValue(input.locale),
      input.authMode,
      hasResponseBytes ? "response_bytes_known" : "response_bytes_unknown",
      input.ssrClass,
      input.authSignalPresence,
      boundedValue(input.catalogDetailTab),
    ],
    doubles: [
      input.ioObservedDurationMs,
      input.status,
      input.responseBytes ?? 0,
      input.authIoObservedDurationMs,
      input.appIoObservedDurationMs,
    ],
  });
}

export function writeMcpTransportAnalytics(input: McpTransportAnalyticsInput) {
  const rpcSummary = input.rpcSummary;
  writeAnalyticsDataPoint({
    indexes: [`mcp:${boundedValue(input.phase)}`],
    blobs: [
      "mcp_transport_v2",
      input.phase,
      input.method,
      input.path,
      String(input.status),
      statusClass(input.status),
      rpcSummary?.bodyKind ?? "none",
      boundedList(rpcSummary?.methods),
      boundedList(rpcSummary?.toolNames),
      boundedList(rpcSummary?.argumentKeys),
      input.errorName ?? "none",
    ],
    doubles: [
      input.ioObservedDurationMs,
      input.status,
      rpcSummary?.rpcCount ?? 0,
      input.toolCount ?? 0,
    ],
  });
}

export function writeOAuthEventAnalytics(input: OAuthEventAnalyticsInput) {
  const status = input.status ?? 0;
  writeAnalyticsDataPoint({
    indexes: [`oauth:${boundedValue(input.path ?? input.event)}`],
    blobs: [
      "oauth_event_v2",
      input.event,
      input.method ?? "unknown",
      input.path ?? "unknown",
      String(status),
      statusClass(status),
      input.grantType ?? "none",
      input.hasResource === undefined
        ? "resource_unknown"
        : input.hasResource
          ? "has_resource"
          : "no_resource",
      input.statusReason ?? "none",
      input.phase ?? "none",
      input.errorName ?? "none",
    ],
    doubles: [
      input.ioObservedDurationMs,
      status,
      input.resourceCount ?? 0,
      input.scopeCount ?? 0,
    ],
  });
}

export function writeAuditWriteAnalytics(input: AuditWriteAnalyticsInput) {
  writeAnalyticsDataPoint({
    indexes: [`audit:${boundedValue(input.action)}`],
    blobs: [
      "audit_write_v2",
      input.event,
      input.action,
      input.targetType ?? "unknown",
    ],
    doubles: [input.ioObservedDurationMs],
  });
}

export function writeStorageOperationAnalytics(
  input: StorageOperationAnalyticsInput,
) {
  writeAnalyticsDataPoint({
    indexes: [`storage:${boundedValue(input.operation)}`],
    blobs: ["storage_operation_v2", input.event, input.operation],
    doubles: [input.ioObservedDurationMs, input.size ?? 0],
  });
}

export function writeCacheEventAnalytics(input: CacheEventAnalyticsInput) {
  writeAnalyticsDataPoint({
    indexes: [`cache:${boundedValue(input.namespace)}`],
    blobs: [
      "public_runtime_cache_v2",
      input.event,
      input.namespace,
      input.reason ?? "none",
    ],
    doubles: [input.ioObservedDurationMs, input.ttlMs, input.storeSize],
  });
}

export function writeCalendarFeedCacheAnalytics(
  input: CalendarFeedCacheAnalyticsInput,
) {
  writeAnalyticsDataPoint({
    indexes: [`cache:calendar:${boundedValue(input.feed)}`],
    blobs: ["calendar_feed_cache", input.feed, input.status],
    doubles: [input.ttlMs, input.storeSize],
  });
}

export function writeWorkspaceOverviewStageAnalytics(
  input: WorkspaceOverviewStageAnalyticsInput,
) {
  writeAnalyticsDataPoint({
    indexes: [`workspace:overview:${input.stage}`],
    blobs: ["workspace_overview_stage_v1", input.stage, input.status],
    doubles: [input.ioObservedDurationMs],
  });
}

export function writeWorkspaceRouteStageAnalytics(
  input: WorkspaceRouteStageAnalyticsInput,
) {
  writeAnalyticsDataPoint({
    indexes: [`workspace:${input.route}:${input.stage}`],
    blobs: ["workspace_route_stage_v1", input.route, input.stage, input.status],
    doubles: [input.ioObservedDurationMs],
  });
}

export function writeGraphqlOperationAnalytics(
  input: GraphqlOperationAnalyticsInput,
) {
  writeAnalyticsDataPoint({
    indexes: [`graphql:${boundedValue(input.operationType)}`],
    blobs: [
      "graphql_operation_v2",
      boundedValue(input.operationName),
      boundedValue(input.operationType),
      boundedValue(input.authMode),
      boundedValue(input.requestId),
    ],
    doubles: [
      input.ioObservedDurationMs,
      input.topLevelFieldCount,
      input.estimatedCost,
      input.errorCount,
      input.internalErrorCount,
    ],
  });
}

export function writeDatabaseEventAnalytics(
  input: DatabaseEventAnalyticsInput,
) {
  writeAnalyticsDataPoint({
    indexes: [`database:${input.event}`],
    blobs: ["database_event", input.event, boundedValue(input.errorName)],
    doubles: [1],
  });
}
