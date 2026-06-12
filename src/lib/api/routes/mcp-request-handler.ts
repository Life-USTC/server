import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { logAppEvent } from "@/lib/log/app-logger";
import { logOAuthDebug, oauthDebugCorrelationId } from "@/lib/log/oauth-debug";
import { validateMcpOrigin, withMcpCors } from "./mcp-cors";
import {
  logMcpTransportRequest,
  type McpRequestSummary,
} from "./mcp-request-logging";
import { recordAndLogMcpResponse } from "./mcp-response-bookkeeping";
import {
  getRegisteredToolCount,
  getRegisteredToolNames,
} from "./mcp-route-metrics";

export async function handleMcpRequest(request: Request) {
  const start = Date.now();
  const requestUrl = new URL(request.url);
  const correlationId = oauthDebugCorrelationId(request);
  const logContext = { correlationId, request, requestUrl };
  let rpcSummary: McpRequestSummary | null = null;
  logMcpTransportRequest(logContext);

  const originError = validateMcpOrigin(request);
  if (originError) {
    recordAndLogMcpResponse({
      context: logContext,
      request,
      phase: "origin-rejected",
      rpcSummary,
      status: originError.status,
      start,
    });
    return originError;
  }

  const { authenticateMcpRequest } = await import("@/lib/mcp/auth");
  const authResult = await authenticateMcpRequest(request);
  if ("response" in authResult) {
    const res = authResult.response;
    const www = res.headers.get("www-authenticate");
    const wwwAuthenticatePrefix = www ? www.slice(0, 120) : null;
    recordAndLogMcpResponse({
      context: logContext,
      request,
      phase: "auth-rejected",
      rpcSummary,
      status: res.status,
      start,
      wwwAuthenticatePrefix,
    });
    return withMcpCors(request, res);
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const { createMcpServer } = await import("@/lib/mcp/server");
  const {
    recordMcpJsonRpcSummaryMetrics,
    recordMcpToolResultMetrics,
    summarizeMcpJsonRpcRequest,
  } = await import("@/lib/mcp/observability");
  const server = createMcpServer();
  const toolCount = getRegisteredToolCount(server);
  const knownToolNames = getRegisteredToolNames(server);
  rpcSummary = await summarizeMcpJsonRpcRequest(request);
  recordMcpJsonRpcSummaryMetrics(rpcSummary, knownToolNames);
  logAppEvent("info", "mcp.transport.rpc", {
    correlationId,
    method: request.method,
    path: requestUrl.pathname,
    rpcSummary,
    toolCount: toolCount ?? undefined,
  });
  logOAuthDebug("mcp.rpc", request, {
    rpcSummary,
    toolCount: toolCount ?? undefined,
  });

  await server.connect(transport);
  const res = await transport.handleRequest(request, {
    authInfo: authResult.authInfo,
  });
  const durationMs = recordAndLogMcpResponse({
    context: logContext,
    request,
    phase: "handled",
    rpcSummary,
    status: res.status,
    start,
    toolCount: toolCount ?? undefined,
  });
  recordMcpToolResultMetrics(rpcSummary, knownToolNames, {
    durationMs,
    status: res.status,
  });
  return withMcpCors(request, res);
}
