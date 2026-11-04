import { logAppEvent } from "@/lib/log/app-logger";
import { logOAuthDebug } from "@/lib/log/oauth-debug";
import {
  shouldLogSampledSuccess,
  shouldLogSuccessfulRequest,
} from "@/lib/log/request-log-sampling";
import type { McpAuthFailureDiagnostics } from "@/lib/mcp/auth-errors";
import type { McpResponsePhase } from "@/lib/mcp/observability-types";

export type McpRequestSummary = Awaited<
  ReturnType<
    typeof import("@/lib/mcp/observability")["summarizeMcpJsonRpcRequest"]
  >
>;

function safeRpcSummary(summary: McpRequestSummary | null, request: Request) {
  if (!summary) return undefined;
  return {
    rpcBodyKind: summary.bodyKind,
    rpcCount: summary.rpcCount,
    rpcToolCount: summary.toolNames.length,
    rpcMethod: safeRpcMethod(summary.methods),
    protocolFamily: safeProtocolFamily(
      summary.protocolVersion ??
        request.headers.get("mcp-protocol-version") ??
        undefined,
    ),
  };
}

// Only closed categories enter transport logs; never echo client-controlled names.
function safeRpcMethod(methods: string[]) {
  if (methods.length !== 1) return "other";
  switch (methods[0]) {
    case "initialize":
    case "server/discover":
    case "tools/list":
    case "tools/call":
    case "notifications/initialized":
      return methods[0];
    default:
      return "other";
  }
}

function safeProtocolFamily(version: string | undefined) {
  if (version === undefined) return "unspecified";
  if (version === "2026-07-28") return "modern";
  if (
    [
      "2024-10-07",
      "2024-11-05",
      "2025-03-26",
      "2025-06-18",
      "2025-11-25",
    ].includes(version)
  )
    return "legacy";
  return "other";
}

function safeContentType(request: Request) {
  const value = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (value.includes("application/json")) return "json";
  if (value.includes("text/event-stream")) return "sse";
  return value ? "other" : "none";
}

type McpLogContext = {
  correlationId: string;
  request: Request;
  requestUrl: URL;
};

export function logMcpTransportRequest({
  correlationId,
  request,
  requestUrl,
}: McpLogContext) {
  if (!shouldLogSampledSuccess(correlationId, 10)) return;
  logAppEvent("info", "mcp.transport.request", {
    correlationId,
    method: request.method,
    path: requestUrl.pathname,
    acceptPresent: request.headers.has("accept"),
    contentType: safeContentType(request),
    originPresent: request.headers.has("origin"),
    mcpProtocolVersionPresent: request.headers.has("mcp-protocol-version"),
    mcpSessionIdPresent: request.headers.has("mcp-session-id"),
  });
  logOAuthDebug("mcp.request", request, {
    method: request.method,
    path: requestUrl.pathname,
    acceptPresent: request.headers.has("accept"),
    contentType: safeContentType(request),
  });
}

export function logMcpTransportResponse({
  context,
  hasError,
  inspectionTruncated,
  ioObservedDurationMs,
  errorName,
  phase,
  rpcSummary,
  status,
  authFailureDiagnostics,
  toolCount,
  wwwAuthenticatePrefix,
}: {
  authFailureDiagnostics?: McpAuthFailureDiagnostics | null;
  context: McpLogContext;
  errorName?: string;
  hasError?: boolean;
  inspectionTruncated?: boolean;
  ioObservedDurationMs: number;
  phase: McpResponsePhase;
  rpcSummary: McpRequestSummary | null;
  status: number;
  toolCount?: number;
  wwwAuthenticatePrefix?: string | null;
}) {
  const { correlationId, request, requestUrl } = context;
  const responseHasError =
    hasError === true || status >= 400 || phase === "error";
  const inspectionWasTruncated = inspectionTruncated === true;
  if (
    !responseHasError &&
    !inspectionWasTruncated &&
    !shouldLogSuccessfulRequest({
      durationMs: ioObservedDurationMs,
      requestId: correlationId,
      samplePercent: 10,
      status,
    })
  ) {
    return;
  }
  logAppEvent(
    phase === "error" ||
      status >= 500 ||
      (status < 400 && responseHasError && phase === "handled")
      ? "error"
      : "info",
    "mcp.transport.response",
    {
      correlationId,
      method: request.method,
      path: requestUrl.pathname,
      status,
      ioObservedDurationMs,
      phase,
      hasError: responseHasError,
      inspectionTruncated: inspectionWasTruncated,
      ...safeRpcSummary(rpcSummary, request),
      ...(errorName === undefined ? {} : { errorName }),
      ...(authFailureDiagnostics ?? {}),
      ...(toolCount === undefined ? {} : { toolCount }),
      ...(wwwAuthenticatePrefix === undefined ? {} : { wwwAuthenticatePrefix }),
    },
  );
  logOAuthDebug("mcp.response", request, {
    status,
    ioObservedDurationMs,
    phase,
    hasError: responseHasError,
    inspectionTruncated: inspectionWasTruncated,
    ...(authFailureDiagnostics ?? {}),
    ...(toolCount === undefined ? {} : { toolCount }),
    ...(wwwAuthenticatePrefix === undefined ? {} : { wwwAuthenticatePrefix }),
  });
}
