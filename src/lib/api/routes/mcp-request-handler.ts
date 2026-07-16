import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { rateLimitResponse } from "@/lib/api/helpers";
import { logAppEvent } from "@/lib/log/app-logger";
import { logOAuthDebug, oauthDebugCorrelationId } from "@/lib/log/oauth-debug";
import {
  extractMcpToolCallNamesFromRequest,
  getMcpWriteRateLimitAction,
  getMcpWriteRateLimitTier,
  isMcpWriteTool,
} from "@/lib/mcp/tool-scopes";
import {
  checkUserMutationRateLimit,
  USER_MUTATION_RATE_LIMIT_PERIOD_SECONDS,
} from "@/lib/security/user-mutation-rate-limit";
import { validateMcpOrigin, withMcpCors } from "./mcp-cors";
import {
  logMcpTransportRequest,
  type McpRequestSummary,
} from "./mcp-request-logging";
import { recordAndLogMcpResponse } from "./mcp-response-bookkeeping";

function getRegisteredToolCount(server: unknown) {
  const tools = (server as unknown as { _registeredTools?: object })
    ._registeredTools;
  return tools ? Object.keys(tools).length : null;
}

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

  const toolCallNames = await extractMcpToolCallNamesFromRequest(request);
  const toolNames = Array.from(new Set(toolCallNames));
  const { authenticateMcpRequest } = await import("@/lib/mcp/auth");
  const authResult = await authenticateMcpRequest(request, toolNames);
  if ("response" in authResult) {
    const res = authResult.response;
    const www = res.headers.get("www-authenticate");
    const wwwAuthenticatePrefix = www ? www.slice(0, 120) : null;
    recordAndLogMcpResponse({
      authFailureDiagnostics: authResult.authFailureDiagnostics,
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

  const { summarizeMcpJsonRpcRequest } = await import(
    "@/lib/mcp/observability"
  );
  rpcSummary = await summarizeMcpJsonRpcRequest(request);

  const userId = authResult.authInfo.extra?.userId;
  if (typeof userId === "string" && userId.length > 0) {
    for (const toolName of toolCallNames) {
      if (!isMcpWriteTool(toolName)) continue;
      const outcome = await checkUserMutationRateLimit({
        action: getMcpWriteRateLimitAction(toolName),
        host: requestUrl.host,
        tier: getMcpWriteRateLimitTier(toolName),
        userId,
      });
      if (!outcome.allowed) {
        const response = rateLimitResponse(
          outcome.reason,
          USER_MUTATION_RATE_LIMIT_PERIOD_SECONDS,
        );
        recordAndLogMcpResponse({
          context: logContext,
          request,
          phase: "rate-limit-rejected",
          rpcSummary,
          status: response.status,
          start,
        });
        return withMcpCors(request, response);
      }
    }
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const { createMcpServer } = await import("@/lib/mcp/server");
  const server = createMcpServer();
  const toolCount = getRegisteredToolCount(server);
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
  recordAndLogMcpResponse({
    context: logContext,
    request,
    phase: "handled",
    rpcSummary,
    status: res.status,
    start,
    toolCount: toolCount ?? undefined,
  });
  return withMcpCors(request, res);
}
