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

function safeRpcSummary(summary: McpRequestSummary | null) {
  if (!summary) return undefined;
  return {
    rpcBodyKind: summary.bodyKind,
    rpcCount: summary.rpcCount,
    rpcToolCount: summary.toolNames.length,
  };
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
    phase === "error" || (responseHasError && phase === "handled")
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
      ...safeRpcSummary(rpcSummary),
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
