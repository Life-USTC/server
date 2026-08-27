import { elapsedMs } from "@/lib/log/observability-clock";
import type { McpAuthFailureDiagnostics } from "@/lib/mcp/auth-errors";
import type { McpResponsePhase } from "@/lib/mcp/observability-types";
import { writeMcpTransportAnalytics } from "@/lib/metrics/analytics-engine";
import {
  logMcpTransportResponse,
  type McpRequestSummary,
} from "./mcp-request-logging";

export function recordAndLogMcpResponse(input: {
  authFailureDiagnostics?: McpAuthFailureDiagnostics | null;
  context: {
    correlationId: string;
    request: Request;
    requestUrl: URL;
  };
  errorName?: string;
  hasError?: boolean;
  inspectionTruncated?: boolean;
  phase: McpResponsePhase;
  request: Request;
  rpcSummary: McpRequestSummary | null;
  start: number;
  responseBytes?: number;
  status: number;
  toolCount?: number;
  wwwAuthenticatePrefix?: string | null;
}) {
  const ioObservedDurationMs = elapsedMs(input.start);
  const hasError =
    input.hasError === true || input.status >= 400 || input.phase === "error";
  logMcpTransportResponse({
    authFailureDiagnostics: input.authFailureDiagnostics,
    context: input.context,
    ioObservedDurationMs,
    errorName: input.errorName,
    hasError,
    inspectionTruncated: input.inspectionTruncated,
    phase: input.phase,
    rpcSummary: input.rpcSummary,
    status: input.status,
    toolCount: input.toolCount,
    wwwAuthenticatePrefix: input.wwwAuthenticatePrefix,
  });
  writeMcpTransportAnalytics({
    errorName: input.errorName,
    hasError,
    ioObservedDurationMs,
    method: input.context.request.method,
    path: input.context.requestUrl.pathname,
    phase: input.phase,
    rpcSummary: input.rpcSummary,
    inspectionTruncated: input.inspectionTruncated,
    status: input.status,
    requestBytes: requestContentLength(input.request),
    responseBytes: input.responseBytes,
    toolCount: input.toolCount,
  });
  return ioObservedDurationMs;
}

function requestContentLength(request: Request) {
  const value = request.headers.get("content-length");
  if (!value || !/^\d+$/.test(value)) return undefined;
  const length = Number(value);
  return Number.isSafeInteger(length) ? length : undefined;
}
