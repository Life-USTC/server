import type { McpAuthFailureDiagnostics } from "@/lib/mcp/auth-errors";
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
  phase: "auth-rejected" | "handled" | "origin-rejected";
  request: Request;
  rpcSummary: McpRequestSummary | null;
  start: number;
  status: number;
  toolCount?: number;
  wwwAuthenticatePrefix?: string | null;
}) {
  const durationMs = Date.now() - input.start;
  logMcpTransportResponse({
    authFailureDiagnostics: input.authFailureDiagnostics,
    context: input.context,
    durationMs,
    phase: input.phase,
    rpcSummary: input.rpcSummary,
    status: input.status,
    toolCount: input.toolCount,
    wwwAuthenticatePrefix: input.wwwAuthenticatePrefix,
  });
  writeMcpTransportAnalytics({
    durationMs,
    method: input.context.request.method,
    path: input.context.requestUrl.pathname,
    phase: input.phase,
    rpcSummary: input.rpcSummary,
    status: input.status,
    toolCount: input.toolCount,
  });
  return durationMs;
}
