import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isTrustedAuthOrigin } from "@/lib/auth/auth-origins";
import { logAppEvent } from "@/lib/log/app-logger";
import { logOAuthDebug, oauthDebugCorrelationId } from "@/lib/log/oauth-debug";
import { authenticateMcpRequest } from "@/lib/mcp/auth";
import {
  type McpRequestSummary,
  recordMcpJsonRpcSummaryMetrics,
  recordMcpToolResultMetrics,
  summarizeMcpJsonRpcRequest,
} from "@/lib/mcp/observability";
import { createMcpServer } from "@/lib/mcp/server";
import { recordMcpHttpRequestMetric } from "@/lib/metrics/observability-metrics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MCP_CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers": "MCP-Session-Id, WWW-Authenticate",
} as const;

function appendVaryHeader(headers: Headers, value: string) {
  const existing = headers.get("Vary");
  const parts = new Set(
    (existing ? existing.split(",") : [])
      .map((item) => item.trim())
      .filter(Boolean),
  );
  parts.add(value);
  headers.set("Vary", Array.from(parts).join(", "));
}

function buildMcpCorsHeaders(request: Request, responseHeaders?: HeadersInit) {
  const headers = new Headers(responseHeaders);
  for (const [key, value] of Object.entries(MCP_CORS_HEADERS)) {
    headers.set(key, value);
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    headers.set("Access-Control-Allow-Origin", "*");
    return headers;
  }

  headers.set("Access-Control-Allow-Origin", origin);
  appendVaryHeader(headers, "Origin");
  return headers;
}

function withMcpCors(request: Request, response: Response) {
  const headers = new Headers(response.headers);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: buildMcpCorsHeaders(request, headers),
  });
}

function buildInvalidOriginResponse() {
  return new Response(JSON.stringify({ error: "invalid_origin" }), {
    status: 403,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function validateMcpOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return null;
  }
  return isTrustedAuthOrigin(origin) ? null : buildInvalidOriginResponse();
}

function getRegisteredToolCount(server: ReturnType<typeof createMcpServer>) {
  const tools = (server as unknown as { _registeredTools?: object })
    ._registeredTools;
  return tools ? Object.keys(tools).length : null;
}

function getRegisteredToolNames(server: ReturnType<typeof createMcpServer>) {
  const tools = (server as unknown as { _registeredTools?: object })
    ._registeredTools;
  return new Set(Object.keys(tools ?? {}));
}

function recordMcpResponseMetric(input: {
  request: Request;
  phase: string;
  status: number;
  start: number;
}) {
  const durationMs = Date.now() - input.start;
  recordMcpHttpRequestMetric({
    method: input.request.method,
    phase: input.phase,
    status: input.status,
    durationMs,
  });
  return durationMs;
}

async function handleMcpRequest(request: Request) {
  const start = Date.now();
  const requestUrl = new URL(request.url);
  const correlationId = oauthDebugCorrelationId(request);
  let rpcSummary: McpRequestSummary | null = null;
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

  const originError = validateMcpOrigin(request);
  if (originError) {
    const durationMs = recordMcpResponseMetric({
      request,
      phase: "origin-rejected",
      status: originError.status,
      start,
    });
    logAppEvent("info", "mcp.transport.response", {
      correlationId,
      method: request.method,
      path: requestUrl.pathname,
      status: originError.status,
      durationMs,
      phase: "origin-rejected",
      rpcSummary,
    });
    logOAuthDebug("mcp.response", request, {
      status: originError.status,
      ms: durationMs,
      phase: "origin-rejected",
    });
    return originError;
  }

  const authResult = await authenticateMcpRequest(request);
  if ("response" in authResult) {
    const res = authResult.response;
    const www = res.headers.get("www-authenticate");
    const durationMs = recordMcpResponseMetric({
      request,
      phase: "auth-rejected",
      status: res.status,
      start,
    });
    logAppEvent("info", "mcp.transport.response", {
      correlationId,
      method: request.method,
      path: requestUrl.pathname,
      status: res.status,
      durationMs,
      phase: "auth-rejected",
      rpcSummary,
      wwwAuthenticatePrefix: www ? www.slice(0, 120) : null,
    });
    logOAuthDebug("mcp.response", request, {
      status: res.status,
      ms: durationMs,
      phase: "auth-rejected",
      wwwAuthenticatePrefix: www ? www.slice(0, 200) : null,
    });
    return withMcpCors(request, res);
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
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
    toolCount,
  });
  logOAuthDebug("mcp.rpc", request, {
    rpcSummary,
    toolCount,
  });

  await server.connect(transport);
  const res = await transport.handleRequest(request, {
    authInfo: authResult.authInfo,
  });
  const durationMs = recordMcpResponseMetric({
    request,
    phase: "handled",
    status: res.status,
    start,
  });
  recordMcpToolResultMetrics(rpcSummary, knownToolNames, {
    durationMs,
    status: res.status,
  });
  logAppEvent("info", "mcp.transport.response", {
    correlationId,
    method: request.method,
    path: requestUrl.pathname,
    status: res.status,
    durationMs,
    phase: "handled",
    rpcSummary,
    toolCount,
  });
  logOAuthDebug("mcp.response", request, {
    status: res.status,
    ms: durationMs,
    phase: "handled",
    toolCount,
  });
  return withMcpCors(request, res);
}

export async function GET(request: Request) {
  return handleMcpRequest(request);
}

export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request) {
  return handleMcpRequest(request);
}

export function OPTIONS(request: Request) {
  const originError = validateMcpOrigin(request);
  if (originError) {
    return originError;
  }
  return new Response(null, {
    status: 204,
    headers: buildMcpCorsHeaders(request),
  });
}
