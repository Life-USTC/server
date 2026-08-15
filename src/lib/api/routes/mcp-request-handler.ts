import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { runCloudflareTraceSpan } from "@/lib/adapters/cloudflare-runtime";
import { rateLimitResponse } from "@/lib/api/helpers";
import { logAppEvent } from "@/lib/log/app-logger";
import { logOAuthDebug, oauthDebugCorrelationId } from "@/lib/log/oauth-debug";
import { getSafeErrorName } from "@/lib/log/safe-error-name";
import { getRegisteredMcpToolCount } from "@/lib/mcp/tool-descriptors";
import {
  extractMcpToolCallNames,
  getMcpToolUsageCategory,
  getMcpWriteRateLimitAction,
  getMcpWriteRateLimitTier,
  isMcpWriteTool,
  mcpToolCallsRequireAuthentication,
} from "@/lib/mcp/tool-scopes";
import { scheduleOAuthGrantUsage } from "@/lib/oauth/grant-usage";
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

type McpOAuthUsage = {
  userId: string;
  clientId: string;
  grantId?: string;
  feature: string;
  action: "read" | "write";
};

function mcpJsonValueHasError(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(mcpJsonValueHasError);
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (record.error) return true;
  const result = record.result;
  return (
    !!result &&
    typeof result === "object" &&
    (result as Record<string, unknown>).isError === true
  );
}

async function mcpResponseHasError(response: Response) {
  if (response.status >= 400) return true;
  const contentType = response.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      return mcpJsonValueHasError(await response.clone().json());
    }
    if (contentType.includes("text/event-stream")) {
      const text = await response.clone().text();
      return text
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .some((line) => {
          try {
            return mcpJsonValueHasError(JSON.parse(line.slice(5).trim()));
          } catch {
            return false;
          }
        });
    }
  } catch {
    // A response that cannot be inspected still retains its HTTP outcome.
  }
  return false;
}

async function finishMcpOAuthUsage(
  usage: McpOAuthUsage[],
  outcome: "success" | "error",
) {
  await Promise.all(
    usage.map((input) =>
      scheduleOAuthGrantUsage({
        ...input,
        channel: "mcp",
        outcome,
      }),
    ),
  );
}

export async function handleMcpRequest(request: Request) {
  const start = Date.now();
  const requestUrl = new URL(request.url);
  const correlationId = oauthDebugCorrelationId(request);
  const logContext = { correlationId, request, requestUrl };
  let rpcSummary: McpRequestSummary | null = null;
  let toolCount: number | undefined;
  let oauthUsage: McpOAuthUsage[] = [];
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
    let authInfo: AuthInfo | undefined;
    if (
      request.headers.has("authorization") ||
      mcpToolCallsRequireAuthentication(toolNames)
    ) {
      const { authenticateMcpRequest } = await import("@/lib/mcp/auth");
      const authResult = await runCloudflareTraceSpan(
        "mcp.authenticate",
        { "http.request.method": request.method },
        () => authenticateMcpRequest(request, toolNames),
      );
      if ("response" in authResult) {
        const res = authResult.response;
        const www = res.headers.get("www-authenticate");
        recordAndLogMcpResponse({
          authFailureDiagnostics: authResult.authFailureDiagnostics,
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
      authInfo = authResult.authInfo;
    }

    if (authInfo && typeof authInfo.extra?.userId === "string") {
      oauthUsage = toolCallNames.flatMap((toolName) => {
        // graphql_operation_run records each selected field through its
        // GraphQL principal while retaining the MCP channel.
        if (toolName === "graphql_operation_run") return [];
        const usage = getMcpToolUsageCategory(toolName);
        if (!usage) return [];
        return [
          {
            userId: authInfo.extra?.userId as string,
            clientId: authInfo.clientId,
            grantId:
              typeof authInfo.extra?.grantId === "string"
                ? authInfo.extra.grantId
                : undefined,
            feature: usage.feature,
            action: usage.action,
          },
        ];
      });
    }

    const { summarizeMcpJsonRpcBody } = await import("@/lib/mcp/observability");
    rpcSummary =
      bodyResult.body === undefined
        ? null
        : summarizeMcpJsonRpcBody(bodyResult.body);

    const userId = authInfo?.extra?.userId;
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
          await finishMcpOAuthUsage(oauthUsage, "error");
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
          authInfo,
          parsedBody: bodyResult.body,
        }),
    );
    await finishMcpOAuthUsage(
      oauthUsage,
      (await mcpResponseHasError(res)) ? "error" : "success",
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
    await finishMcpOAuthUsage(oauthUsage, "error");
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
