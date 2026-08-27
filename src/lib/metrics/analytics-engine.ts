import type { AppLocale } from "@/i18n/config";
import {
  getCloudflareAnalyticsEngineDataset,
  getCloudflareRuntimeEnvInput,
} from "@/lib/adapters/cloudflare-runtime";
import { emitLog } from "@/lib/log/app-log-emitter";
import { getSafeErrorName } from "@/lib/log/safe-error-name";
import type {
  McpRequestSummary,
  McpResponsePhase,
} from "@/lib/mcp/observability-types";
import type {
  PageAuthSignalPresence,
  PageCatalogDetailTab,
  PageSsrClass,
} from "@/lib/metrics/page-request-attribution";

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
  authSignalPresence: PageAuthSignalPresence;
  catalogDetailTab: PageCatalogDetailTab;
  event: "finish" | "error";
  ioObservedDurationMs: number;
  locale: string;
  method: string;
  responseBytes?: number;
  route: string;
  ssrClass: PageSsrClass;
  status: number;
};

type McpTransportAnalyticsInput = {
  errorName?: string;
  hasError?: boolean;
  ioObservedDurationMs: number;
  method: string;
  path: string;
  phase: McpResponsePhase;
  rpcSummary: McpRequestSummary | null;
  inspectionTruncated?: boolean;
  requestBytes?: number;
  responseBytes?: number;
  status: number;
  toolCount?: number;
};

export type WorkerRequestAnalyticsInput = {
  cacheOutcome: string;
  durationMs: number;
  method: string;
  requestClass: string;
  route: string;
  status: number;
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
  | "catalog:current-semester"
  | "sitemap"
  | `page:section-detail:overview:${AppLocale}`
  | `search:catalog:v4:${AppLocale}`
  | `bus:timetable:${AppLocale}`
  | `catalog:${
      | "courses"
      | "schedules"
      | "sections"
      | "teachers"}-list:${AppLocale}`
  | `catalog:${"course" | "section" | "teacher"}-detail:${AppLocale}`
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

type CalendarExportRebuildAnalyticsInput = {
  status:
    | "enqueue_error"
    | "enqueued"
    | "error"
    | "ok"
    | "refresh_error"
    | "store_error";
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

export type QueueBatchAnalyticsInput = {
  acked: number;
  batchSize: number;
  durationMs: number;
  invalid: number;
  maxAgeMs: number;
  maxAttempts: number;
  outcome: "error" | "partial" | "retry" | "success";
  processed: number;
  queue: "audit" | "calendar" | "unknown";
  retried: number;
  messageType: string;
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

export type CommentsStage =
  | "target.resolve"
  | "viewer.context"
  | "comments.root"
  | "comments.descendants"
  | "comments.summaries"
  | "target.payload";

export type DashboardStage =
  | "recent_session"
  | "user_context"
  | "nav_stats"
  | "tab";

export type DbStageContext = "none" | "rls";
export type DbStageLabel = "app" | "auth" | "maintenance";

export type CommentsStageAnalyticsInput = {
  dbContext: DbStageContext;
  dbQueryCount: number;
  dbTransactionCount: number;
  durationMs: number;
  loadedCount?: number;
  outcome: "error" | "success";
  rootCount?: number;
  stage: CommentsStage;
  dbLabel: DbStageLabel;
};

export type DashboardStageAnalyticsInput = {
  dbContext: DbStageContext;
  dbQueryCount: number;
  dbTransactionCount: number;
  durationMs: number;
  loadedCount?: number;
  outcome: "error" | "success";
  rootCount?: number;
  stage: DashboardStage;
  subscribedSectionCount?: number;
  dbLabel: DbStageLabel;
};

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
  if (!Number.isInteger(status) || status < 100 || status > 599) {
    return "unknown";
  }
  return `${Math.floor(status / 100)}xx`;
}

const HTTP_METHODS = new Set([
  "CONNECT",
  "DELETE",
  "GET",
  "HEAD",
  "OPTIONS",
  "PATCH",
  "POST",
  "PUT",
  "TRACE",
]);
const WORKER_REQUEST_CLASSES = new Set([
  "catalog-redirect",
  "dynamic",
  "public-not-found",
  "public-ssr-cache",
]);
const EDGE_CACHE_OUTCOMES = new Set([
  "bypass",
  "dynamic",
  "hit",
  "miss",
  "revalidated",
  "stale",
  "unknown",
  "updating",
]);
const MCP_METHOD_FAMILIES = new Set([
  "initialize",
  "notifications",
  "prompts",
  "resources",
  "tools",
]);
const MCP_BODY_KINDS = new Set([
  "body-too-large",
  "empty",
  "invalid-json",
  "json-non-rpc",
  "jsonrpc-batch",
  "jsonrpc-single",
  "not-post",
]);
const MCP_TOOL_FAMILIES = new Set([
  "account",
  "catalog",
  "community",
  "graphql",
  "workspace",
]);
const GRAPHQL_OPERATION_TYPES = new Set([
  "mutation",
  "query",
  "subscription",
  "unknown",
]);
const GRAPHQL_AUTH_MODES = new Set([
  "anonymous",
  "oauth",
  "session",
  "unknown",
]);
const MCP_RESPONSE_PHASES = new Set([
  "auth-rejected",
  "body-rejected",
  "error",
  "handled",
  "origin-rejected",
  "rate-limit-rejected",
]);
const MCP_ERROR_NAMES = new Set([
  "AbortError",
  "Error",
  "SyntaxError",
  "TimeoutError",
  "TypeError",
]);
const API_ROUTE_FAMILIES = new Set([
  "account",
  "admin",
  "auth",
  "calendar-feeds",
  "catalog",
  "community",
  "graphql",
  "health",
  "mcp",
  "openapi",
  "search",
  "users",
  "workspace",
]);
const API_AUTH_MODES = new Set([
  "anonymous",
  "bearer",
  "cookie",
  "oauth",
  "session",
  "unknown",
]);
const API_EVENTS = new Set(["error", "finish"]);
const AUDIT_EVENTS = new Set(["error", "success"]);
const QUEUE_NAMES = new Set(["audit", "calendar", "unknown"]);
const QUEUE_MESSAGE_TYPES = new Set(["audit-log.write.v1", "unknown"]);
const QUEUE_OUTCOMES = new Set(["error", "partial", "retry", "success"]);
const OAUTH_EVENTS = new Set([
  "better-auth.error",
  "better-auth.response",
  "device-authorization.error",
  "device-authorization.response",
  "grant-validation-failed",
  "oauth.authorization.code-binding-failed",
  "oauth.authorization.code-binding-rejected",
  "oauth.authorization.grant-expectation-failed",
  "oauth.introspection.grant-verification-failed",
  "oauth.token.error_response",
  "oauth.token.invalid_grant",
  "oauth.token.invalid_request",
  "token.error",
  "token.response",
  "token.stage.error",
  "token.stage.success",
]);
const OAUTH_GRANT_TYPES = new Set([
  "authorization_code",
  "client_credentials",
  "device_code",
  "none",
  "refresh_token",
  "urn:ietf:params:oauth:grant-type:device_code",
]);
const OAUTH_PHASES = new Set([
  "bind-access-token-consent",
  "code-binding",
  "cleanup-rejected-refresh-grant",
  "create-grant",
  "grant-expectation",
  "grant-verification",
  "persist-refresh-resources",
  "recheck-active-refresh-grant",
  "resolve-active-refresh-grant",
  "resolve-grant",
  "validate-active-grant",
  "validate-refresh-resources",
]);
const OAUTH_STATUS_REASONS = new Set([
  "invalid_client",
  "invalid_grant",
  "invalid_request",
  "invalid_scope",
  "invalid_token",
  "server_error",
  "unsupported_grant_type",
  ...MCP_ERROR_NAMES,
]);
const AUDIT_ACTIONS = new Set([
  "account_calendar_token_create",
  "account_calendar_token_rotate",
  "account_credential_update",
  "account_create",
  "account_delete",
  "account_link",
  "account_passkey_create",
  "account_passkey_delete",
  "account_passkey_update",
  "account_profile_update",
  "account_session_revoke",
  "account_sign_in",
  "account_sign_out",
  "account_unlink",
  "admin_bus_import",
  "admin_bus_version_activate",
  "admin_bus_version_delete",
  "admin_comment_moderate",
  "admin_description_moderate",
  "admin_oauth_client_create",
  "admin_oauth_client_delete",
  "admin_user_profile_update",
  "admin_user_role_update",
  "admin_user_suspend",
  "admin_user_unsuspend",
  "comment_create",
  "comment_delete",
  "comment_edit",
  "comment_react",
  "description_edit",
  "homework_create",
  "homework_delete",
  "homework_update",
  "oauth_authorization_grant",
  "oauth_authorization_revoke",
  "oauth_authorization_update",
  "section_reactivate",
  "section_retire",
  "upload_delete",
  "webhook_login",
]);
const AUDIT_TARGET_TYPES = new Set([
  "account",
  "bus_schedule_version",
  "calendar_feed",
  "comment",
  "description",
  "homework",
  "oauth_client",
  "oauth_consent",
  "section",
  "section-teacher",
  "session",
  "upload",
  "user",
]);

function finiteEnum(value: unknown, values: ReadonlySet<string>) {
  const candidate = typeof value === "string" ? value : "";
  return values.has(candidate) ? candidate : "unknown";
}

function safeHttpMethod(value: string) {
  const candidate = value.toUpperCase();
  return HTTP_METHODS.has(candidate) ? candidate : "unknown";
}

function boundedCount(value: number | undefined | null, max = 1_000_000) {
  return Math.min(finiteNumber(value), max);
}

function workerRouteFamily(route: string) {
  const pathname = route.split(/[?#]/, 1)[0] ?? route;
  if (pathname === "/account/sign-in") return "account-sign-in";
  if (pathname.startsWith("/api/")) return "api";
  if (pathname.startsWith("/catalog/")) return "catalog";
  if (pathname === "public-page" || pathname === "public-not-found") {
    return "public";
  }
  if (pathname.startsWith("/")) return "static";
  return "unknown";
}

function apiRouteFamily(route: string) {
  const pathname = route.split(/[?#]/, 1)[0] ?? route;
  const segment = pathname.startsWith("/api/")
    ? pathname.split("/", 3)[2]
    : undefined;
  return segment && API_ROUTE_FAMILIES.has(segment) ? segment : "other";
}

function oauthPathFamily(path: string) {
  const pathname = path.split(/[?#]/, 1)[0] ?? path;
  if (pathname.includes("/.well-known/")) return "well-known";
  const segment = pathname.split("/").filter(Boolean).at(-1);
  if (segment === "token") return "token";
  if (segment === "device-authorization") return "device-authorization";
  if (segment === "authorize") return "authorize";
  if (segment === "callback") return "callback";
  if (segment === "introspect") return "introspect";
  if (segment === "register") return "register";
  if (segment === "revoke") return "revoke";
  if (pathname.startsWith("/api/auth/")) return "auth";
  return "unknown";
}

function mcpMethodFamily(summary: McpRequestSummary | null) {
  const families = new Set(
    (summary?.methods ?? []).map((method) => {
      const family = method.split("/", 1)[0];
      return MCP_METHOD_FAMILIES.has(family) ? family : "unknown";
    }),
  );
  if (families.size === 0) return "none";
  if (families.size > 1) return "mixed";
  return [...families][0] ?? "unknown";
}

function mcpPathFamily(path: string) {
  if (path === "/api/mcp" || path.startsWith("/api/mcp/")) {
    return "/api/mcp";
  }
  return "other";
}

function mcpToolFamily(summary: McpRequestSummary | null) {
  const families = new Set(
    (summary?.toolNames ?? []).map((name) => {
      const family = name.split("_", 1)[0];
      return MCP_TOOL_FAMILIES.has(family) ? family : "unknown";
    }),
  );
  if (families.size === 0) return "none";
  if (families.size > 1) return "mixed";
  return [...families][0] ?? "unknown";
}

function mcpErrorClass(errorName: string | undefined) {
  if (!errorName) return "none";
  return MCP_ERROR_NAMES.has(errorName) ? errorName : "other";
}

function boundedValue(value: unknown) {
  if (value === undefined || value === null) return "unknown";
  return String(value).replaceAll("\n", " ").slice(0, 120) || "unknown";
}

function finiteNumber(value: number | undefined | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

let analyticsBindingMissingLogged = false;
let analyticsWriteFailureLogged = new WeakSet<object>();

function logAnalyticsDiagnostic(
  message: string,
  context: Record<string, unknown>,
) {
  try {
    // This emitter intentionally does not call any Analytics Engine writer, so
    // an unavailable binding cannot recurse back into this module.
    emitLog("[analytics]", "error", { ...context, message });
  } catch {
    // Diagnostics must not become a user-facing failure.
  }
}

function logMissingAnalyticsBinding() {
  if (
    getCloudflareRuntimeEnvInput().NODE_ENV !== "production" ||
    analyticsBindingMissingLogged
  ) {
    return;
  }
  analyticsBindingMissingLogged = true;
  logAnalyticsDiagnostic("analytics-engine.binding-missing", {
    event: "analytics-engine.binding-missing",
    source: "analytics-engine",
  });
}

function logAnalyticsWriteFailure(dataset: object, error: unknown) {
  if (analyticsWriteFailureLogged.has(dataset)) return;
  analyticsWriteFailureLogged.add(dataset);
  logAnalyticsDiagnostic("analytics-engine.write-failed", {
    errorName: getSafeErrorName(error),
    event: "analytics-engine.write-failed",
    source: "analytics-engine",
  });
}

/** Reset diagnostics state between isolated unit-test runtimes. */
export function resetAnalyticsEngineDiagnosticsForTest() {
  analyticsBindingMissingLogged = false;
  analyticsWriteFailureLogged = new WeakSet<object>();
}

function writeAnalyticsDataPoint(input: {
  blobs: string[];
  doubles: number[];
  indexes: string[];
}) {
  const dataset = getCloudflareAnalyticsEngineDataset();
  if (
    !dataset ||
    typeof dataset !== "object" ||
    typeof dataset.writeDataPoint !== "function"
  ) {
    logMissingAnalyticsBinding();
    return;
  }

  try {
    dataset.writeDataPoint({
      // Analytics Engine accepts one index and at most 20 values of either
      // type. Keep the sink bounded even if a future caller accidentally
      // widens an event payload.
      indexes: input.indexes.slice(0, 1).map(boundedValue),
      blobs: input.blobs.slice(0, 20).map(boundedValue),
      doubles: input.doubles.slice(0, 20).map(finiteNumber),
    });
  } catch (error) {
    logAnalyticsWriteFailure(dataset, error);
  }
}

export function writeWorkerRequestAnalytics(
  input: WorkerRequestAnalyticsInput,
) {
  const routeFamily = workerRouteFamily(input.route);
  const requestClass = finiteEnum(input.requestClass, WORKER_REQUEST_CLASSES);
  const cacheOutcome = finiteEnum(input.cacheOutcome, EDGE_CACHE_OUTCOMES);
  writeAnalyticsDataPoint({
    indexes: [`worker:${routeFamily}`],
    blobs: [
      "worker_request_v1",
      "finish",
      routeFamily,
      requestClass,
      safeHttpMethod(input.method),
      statusClass(input.status),
      cacheOutcome,
    ],
    doubles: [finiteNumber(input.durationMs), input.status],
  });
}

export function writeApiRequestAnalytics(input: ApiRequestAnalyticsInput) {
  const routeFamily = apiRouteFamily(input.route);
  writeAnalyticsDataPoint({
    indexes: [`api:${routeFamily}`],
    blobs: [
      "api_request_v2",
      finiteEnum(input.event, API_EVENTS),
      safeHttpMethod(input.method),
      routeFamily,
      String(input.status),
      statusClass(input.status),
      finiteEnum(input.authMode, API_AUTH_MODES),
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
  const responseHasError =
    input.hasError === true || input.status >= 400 || input.phase === "error";
  const bodyKind = rpcSummary
    ? finiteEnum(rpcSummary.bodyKind, MCP_BODY_KINDS)
    : "none";
  writeAnalyticsDataPoint({
    indexes: [`mcp:${finiteEnum(input.phase, MCP_RESPONSE_PHASES)}`],
    blobs: [
      "mcp_transport_v3",
      finiteEnum(input.phase, MCP_RESPONSE_PHASES),
      mcpMethodFamily(rpcSummary),
      mcpPathFamily(input.path),
      statusClass(input.status),
      bodyKind,
      mcpToolFamily(rpcSummary),
      mcpErrorClass(input.errorName),
      responseHasError
        ? "error"
        : input.inspectionTruncated
          ? "unknown"
          : "success",
    ],
    doubles: [
      input.ioObservedDurationMs,
      rpcSummary?.rpcCount ?? 0,
      input.toolCount ?? 0,
      input.requestBytes ?? 0,
      input.responseBytes ?? 0,
      input.inspectionTruncated ? 1 : 0,
    ],
  });
}

export function writeOAuthEventAnalytics(input: OAuthEventAnalyticsInput) {
  const status = input.status ?? 0;
  const pathFamily = oauthPathFamily(input.path ?? "");
  writeAnalyticsDataPoint({
    indexes: [`oauth:${pathFamily}`],
    blobs: [
      "oauth_event_v2",
      finiteEnum(input.event, OAUTH_EVENTS),
      safeHttpMethod(input.method ?? ""),
      pathFamily,
      String(status),
      statusClass(status),
      input.grantType === undefined || input.grantType === null
        ? "none"
        : finiteEnum(input.grantType, OAUTH_GRANT_TYPES),
      input.hasResource === undefined
        ? "resource_unknown"
        : input.hasResource
          ? "has_resource"
          : "no_resource",
      input.statusReason === undefined
        ? "none"
        : finiteEnum(input.statusReason, OAUTH_STATUS_REASONS),
      input.phase === undefined
        ? "none"
        : finiteEnum(input.phase, OAUTH_PHASES),
      input.errorName === undefined ? "none" : mcpErrorClass(input.errorName),
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
  const action = finiteEnum(input.action, AUDIT_ACTIONS);
  const targetType = finiteEnum(input.targetType, AUDIT_TARGET_TYPES);
  writeAnalyticsDataPoint({
    indexes: [`audit:${action}`],
    blobs: [
      "audit_write_v2",
      finiteEnum(input.event, AUDIT_EVENTS),
      action,
      targetType,
    ],
    doubles: [input.ioObservedDurationMs],
  });
}

export function writeQueueBatchAnalytics(input: QueueBatchAnalyticsInput) {
  const queue = finiteEnum(input.queue, QUEUE_NAMES);
  writeAnalyticsDataPoint({
    indexes: [`queue:${queue}`],
    blobs: [
      "queue_batch_v1",
      "finish",
      queue,
      finiteEnum(input.outcome, QUEUE_OUTCOMES),
      finiteEnum(input.messageType, QUEUE_MESSAGE_TYPES),
    ],
    doubles: [
      finiteNumber(input.durationMs),
      boundedCount(input.batchSize),
      boundedCount(input.processed),
      boundedCount(input.acked),
      boundedCount(input.retried),
      boundedCount(input.invalid),
      boundedCount(input.maxAgeMs),
      boundedCount(input.maxAttempts),
    ],
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
      "public_runtime_cache_v3",
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

export function writeCalendarExportRebuildAnalytics(
  input: CalendarExportRebuildAnalyticsInput,
) {
  writeAnalyticsDataPoint({
    indexes: [`calendar_export_rebuild_${input.status}`],
    blobs: ["calendar_export_rebuild", input.status],
    doubles: [1],
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

export function writeCommentsStageAnalytics(
  input: CommentsStageAnalyticsInput,
) {
  writeAnalyticsDataPoint({
    indexes: [`comments:${input.stage}`],
    blobs: [
      "comments_stage_v1",
      input.stage,
      input.dbContext,
      input.dbLabel,
      input.outcome,
    ],
    doubles: [
      finiteNumber(input.durationMs),
      boundedCount(input.dbQueryCount),
      boundedCount(input.dbTransactionCount),
      boundedCount(input.loadedCount),
      boundedCount(input.rootCount),
    ],
  });
}

export function writeDashboardStageAnalytics(
  input: DashboardStageAnalyticsInput,
) {
  writeAnalyticsDataPoint({
    indexes: [`dashboard:${input.stage}`],
    blobs: [
      "dashboard_stage_v1",
      input.stage,
      input.dbContext,
      input.dbLabel,
      input.outcome,
    ],
    doubles: [
      finiteNumber(input.durationMs),
      boundedCount(input.dbQueryCount),
      boundedCount(input.dbTransactionCount),
      boundedCount(input.loadedCount),
      boundedCount(input.rootCount),
      boundedCount(input.subscribedSectionCount),
    ],
  });
}

export function writeGraphqlOperationAnalytics(
  input: GraphqlOperationAnalyticsInput,
) {
  const operationType = finiteEnum(
    input.operationType,
    GRAPHQL_OPERATION_TYPES,
  );
  const authMode = finiteEnum(input.authMode, GRAPHQL_AUTH_MODES);
  const operationFamily =
    input.operationName === "anonymous"
      ? "anonymous"
      : input.operationName === "unknown"
        ? "unknown"
        : "named";
  writeAnalyticsDataPoint({
    indexes: [`graphql:${operationType}`],
    blobs: [
      "graphql_operation_v3",
      operationFamily,
      operationType,
      authMode,
      input.errorCount > 0 || input.internalErrorCount > 0
        ? "error"
        : "success",
    ],
    doubles: [
      finiteNumber(input.ioObservedDurationMs),
      boundedCount(input.topLevelFieldCount),
      boundedCount(input.estimatedCost),
      boundedCount(input.errorCount),
      boundedCount(input.internalErrorCount),
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
