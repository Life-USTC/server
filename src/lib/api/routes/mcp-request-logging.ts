import { logAppEvent } from "@/lib/log/app-logger";
import { logOAuthDebug } from "@/lib/log/oauth-debug";

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
  phase,
  rpcSummary,
  status,
  toolCount,
  wwwAuthenticatePrefix,
}: {
  context: McpLogContext;
  durationMs: number;
  phase: "auth-rejected" | "handled" | "origin-rejected";
  rpcSummary: McpRequestSummary | null;
  status: number;
  toolCount?: number;
  wwwAuthenticatePrefix?: string | null;
}) {
  const { correlationId, request, requestUrl } = context;
  logAppEvent("info", "mcp.transport.response", {
    correlationId,
    method: request.method,
    path: requestUrl.pathname,
    status,
    durationMs,
    phase,
    rpcSummary,
    ...(toolCount === undefined ? {} : { toolCount }),
    ...(wwwAuthenticatePrefix === undefined ? {} : { wwwAuthenticatePrefix }),
  });
  logOAuthDebug("mcp.response", request, {
    status,
    ms: durationMs,
    phase,
    ...(toolCount === undefined ? {} : { toolCount }),
    ...(wwwAuthenticatePrefix === undefined ? {} : { wwwAuthenticatePrefix }),
  });
}
