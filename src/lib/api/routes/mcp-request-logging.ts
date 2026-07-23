import { logAppEvent } from "@/lib/log/app-logger";
import { logOAuthDebug } from "@/lib/log/oauth-debug";
import type { McpAuthFailureDiagnostics } from "@/lib/mcp/auth-errors";
import type { McpResponsePhase } from "@/lib/mcp/observability-types";

export type McpRequestSummary = Awaited<
  ReturnType<
    typeof import("@/lib/mcp/observability")["summarizeMcpJsonRpcRequest"]
  >
>;

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
  logAppEvent("info", "mcp.transport.request", {
    correlationId,
    method: request.method,
    path: requestUrl.pathname,
    accept: request.headers.get("accept")?.slice(0, 120) ?? null,
    contentType: request.headers.get("content-type")?.slice(0, 120) ?? null,
    origin: request.headers.get("origin")?.slice(0, 120) ?? null,
    userAgent: request.headers.get("user-agent")?.slice(0, 120) ?? null,
    mcpProtocolVersionHeader:
      request.headers.get("mcp-protocol-version")?.slice(0, 40) ?? null,
    mcpSessionIdPresent: request.headers.has("mcp-session-id"),
  });
  logOAuthDebug("mcp.request", request, {
    method: request.method,
    path: requestUrl.pathname,
    accept: request.headers.get("accept")?.slice(0, 120) ?? null,
  });
}

export function logMcpTransportResponse({
  context,
  durationMs,
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
  durationMs: number;
  errorName?: string;
  phase: McpResponsePhase;
  rpcSummary: McpRequestSummary | null;
  status: number;
  toolCount?: number;
  wwwAuthenticatePrefix?: string | null;
}) {
  const { correlationId, request, requestUrl } = context;
  logAppEvent(phase === "error" ? "error" : "info", "mcp.transport.response", {
    correlationId,
    method: request.method,
    path: requestUrl.pathname,
    status,
    durationMs,
    phase,
    rpcSummary,
    ...(errorName === undefined ? {} : { errorName }),
    ...(authFailureDiagnostics ?? {}),
    ...(toolCount === undefined ? {} : { toolCount }),
    ...(wwwAuthenticatePrefix === undefined ? {} : { wwwAuthenticatePrefix }),
  });
  logOAuthDebug("mcp.response", request, {
    status,
    ms: durationMs,
    phase,
    ...(authFailureDiagnostics ?? {}),
    ...(toolCount === undefined ? {} : { toolCount }),
    ...(wwwAuthenticatePrefix === undefined ? {} : { wwwAuthenticatePrefix }),
  });
}
