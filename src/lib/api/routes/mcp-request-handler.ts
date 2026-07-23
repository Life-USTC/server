import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { runCloudflareTraceSpan } from "@/lib/adapters/cloudflare-runtime";
import { rateLimitResponse } from "@/lib/api/helpers";
import { logAppEvent } from "@/lib/log/app-logger";
import { logOAuthDebug, oauthDebugCorrelationId } from "@/lib/log/oauth-debug";
import { getSafeErrorName } from "@/lib/log/safe-error-name";
import { getRegisteredMcpToolCount } from "@/lib/mcp/tool-descriptors";
import {
  extractMcpToolCallNames,
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

export async function handleMcpRequest(request: Request) {
  const start = Date.now();
  const requestUrl = new URL(request.url);
  const correlationId = oauthDebugCorrelationId(request);
  const logContext = { correlationId, request, requestUrl };
  let rpcSummary: McpRequestSummary | null = null;
  let toolCount: number | undefined;
  logMcpTransportRequest(logContext);

  try {
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

    const { authenticateMcpRequest, authorizeMcpToolScopes } = await import(
      "@/lib/mcp/auth"
    );
    const authResult = await runCloudflareTraceSpan(
      "mcp.authenticate",
      { "http.request.method": request.method },
      () => authenticateMcpRequest(request),
    );
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

    const { readMcpJsonBodyWithinLimit } = await import(
      "@/lib/mcp/request-body"
    );
    const bodyResult = await runCloudflareTraceSpan("mcp.parse_body", {}, () =>
      readMcpJsonBodyWithinLimit(request),
    );
    if ("response" in bodyResult) {
      recordAndLogMcpResponse({
        context: logContext,
        request,
        phase: "body-rejected",
        rpcSummary,
        status: bodyResult.response.status,
        start,
      });
      return withMcpCors(request, bodyResult.response);
    }

    const toolCallNames = extractMcpToolCallNames(bodyResult.body);
    const toolNames = Array.from(new Set(toolCallNames));
    const toolAuthResult = authorizeMcpToolScopes(
      authResult.authInfo,
      toolNames,
    );
    if ("response" in toolAuthResult) {
      const res = toolAuthResult.response;
      const www = res.headers.get("www-authenticate");
      recordAndLogMcpResponse({
        authFailureDiagnostics: toolAuthResult.authFailureDiagnostics,
        context: logContext,
        request,
        phase: "auth-rejected",
        rpcSummary,
        status: res.status,
        start,
        wwwAuthenticatePrefix: www ? www.slice(0, 120) : null,
      });
      return withMcpCors(request, res);
    }

    const { summarizeMcpJsonRpcBody } = await import("@/lib/mcp/observability");
    rpcSummary =
      bodyResult.body === undefined
        ? null
        : summarizeMcpJsonRpcBody(bodyResult.body);

    const userId = toolAuthResult.authInfo.extra?.userId;
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
    toolCount = getRegisteredMcpToolCount(server);
    logAppEvent("info", "mcp.transport.rpc", {
      correlationId,
      method: request.method,
      path: requestUrl.pathname,
      rpcSummary,
      toolCount,
    });
    logOAuthDebug("mcp.rpc", request, {
      rpcSummary,
      toolCount,
    });

    await server.connect(transport);
    const res = await runCloudflareTraceSpan(
      "mcp.handle_rpc",
      {
        "mcp.rpc_count": rpcSummary?.rpcCount,
        "mcp.tool_count": toolCount,
      },
      () =>
        transport.handleRequest(request, {
          authInfo: toolAuthResult.authInfo,
          parsedBody: bodyResult.body,
        }),
    );
    recordAndLogMcpResponse({
      context: logContext,
      request,
      phase: "handled",
      rpcSummary,
      status: res.status,
      start,
      toolCount,
    });
    return withMcpCors(request, res);
  } catch (error) {
    recordAndLogMcpResponse({
      context: logContext,
      errorName: getSafeErrorName(error),
      request,
      phase: "error",
      rpcSummary,
      status: 500,
      start,
      toolCount,
    });
    throw error;
  }
}
