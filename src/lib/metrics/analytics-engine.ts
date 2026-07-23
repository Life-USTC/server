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
  event: "finish" | "error";
  ioObservedDurationMs: number;
  locale: string;
  method: string;
  responseBytes?: number;
  route: string;
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

type CacheEventAnalyticsInput = {
  event: "hit" | "load_error" | "load_success" | "miss";
  ioObservedDurationMs: number;
  key: string;
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

function cacheNamespace(key: string) {
  const [scope, resource, locale] = key.split(":");
  return [scope, resource, locale].filter(Boolean).map(boundedValue).join(":");
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
    indexes: [`cache:${boundedValue(cacheNamespace(input.key))}`],
    blobs: ["public_runtime_cache_v2", input.event, cacheNamespace(input.key)],
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
