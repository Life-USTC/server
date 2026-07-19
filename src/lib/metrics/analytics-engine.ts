import { getCloudflareAnalyticsEngineDataset } from "@/lib/adapters/cloudflare-runtime";
import type { McpRequestSummary } from "@/lib/mcp/observability-types";

type ApiRequestAnalyticsInput = {
  authMode: string;
  durationMs: number;
  event: "finish" | "error";
  method: string;
  route: string;
  status: number;
};

type McpTransportAnalyticsInput = {
  durationMs: number;
  method: string;
  path: string;
  phase:
    | "auth-rejected"
    | "handled"
    | "origin-rejected"
    | "rate-limit-rejected";
  rpcSummary: McpRequestSummary | null;
  status: number;
  toolCount?: number;
};

type OAuthEventAnalyticsInput = {
  durationMs: number;
  event: string;
  grantType?: string | null;
  hasResource?: boolean;
  method?: string;
  path?: string;
  resourceCount?: number;
  scopeCount?: number;
  status?: number;
  statusReason?: string;
};

type AuditWriteAnalyticsInput = {
  action: string;
  durationMs: number;
  event: "success" | "error";
  targetType?: string;
};

type StorageOperationAnalyticsInput = {
  durationMs: number;
  event: "success" | "error" | "miss";
  operation: "delete" | "get" | "head" | "put";
  size?: number | null;
};

type CacheEventAnalyticsInput = {
  durationMs: number;
  event: "hit" | "load_error" | "load_success" | "miss";
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
  durationMs: number;
  errorCount: number;
  estimatedCost: number;
  operationName: string;
  operationType: string;
  requestId: string;
  topLevelFieldCount: number;
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
      "api_request",
      input.event,
      boundedValue(input.method),
      boundedValue(input.route),
      String(input.status),
      statusClass(input.status),
      boundedValue(input.authMode),
    ],
    doubles: [input.durationMs, input.status],
  });
}

export function writeMcpTransportAnalytics(input: McpTransportAnalyticsInput) {
  const rpcSummary = input.rpcSummary;
  writeAnalyticsDataPoint({
    indexes: [`mcp:${boundedValue(input.phase)}`],
    blobs: [
      "mcp_transport",
      input.phase,
      input.method,
      input.path,
      String(input.status),
      statusClass(input.status),
      rpcSummary?.bodyKind ?? "none",
      boundedList(rpcSummary?.methods),
      boundedList(rpcSummary?.toolNames),
      boundedList(rpcSummary?.argumentKeys),
    ],
    doubles: [
      input.durationMs,
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
      "oauth_event",
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
    ],
    doubles: [
      input.durationMs,
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
      "audit_write",
      input.event,
      input.action,
      input.targetType ?? "unknown",
    ],
    doubles: [input.durationMs],
  });
}

export function writeStorageOperationAnalytics(
  input: StorageOperationAnalyticsInput,
) {
  writeAnalyticsDataPoint({
    indexes: [`storage:${boundedValue(input.operation)}`],
    blobs: ["storage_operation", input.event, input.operation],
    doubles: [input.durationMs, input.size ?? 0],
  });
}

export function writeCacheEventAnalytics(input: CacheEventAnalyticsInput) {
  writeAnalyticsDataPoint({
    indexes: [`cache:${boundedValue(cacheNamespace(input.key))}`],
    blobs: ["public_runtime_cache", input.event, cacheNamespace(input.key)],
    doubles: [input.durationMs, input.ttlMs, input.storeSize],
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
      "graphql_operation",
      boundedValue(input.operationName),
      boundedValue(input.operationType),
      boundedValue(input.authMode),
      boundedValue(input.requestId),
    ],
    doubles: [
      input.durationMs,
      input.topLevelFieldCount,
      input.estimatedCost,
      input.errorCount,
    ],
  });
}
