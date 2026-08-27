import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authenticateMcpRequestMock,
  checkUserMutationRateLimitMock,
  connectMock,
  handleTransportRequestMock,
  inspectMcpResponseMock,
  recordAndLogMcpResponseMock,
  scheduleOAuthGrantUsageMock,
  summarizeMcpJsonRpcRequestMock,
  transportConstructorMock,
} = vi.hoisted(() => ({
  authenticateMcpRequestMock: vi.fn(),
  checkUserMutationRateLimitMock: vi.fn(),
  connectMock: vi.fn(),
  handleTransportRequestMock: vi.fn(),
  inspectMcpResponseMock: vi.fn(),
  recordAndLogMcpResponseMock: vi.fn(),
  scheduleOAuthGrantUsageMock: vi.fn(),
  summarizeMcpJsonRpcRequestMock: vi.fn(),
  transportConstructorMock: vi.fn(),
}));

vi.mock(
  "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js",
  () => ({
    WebStandardStreamableHTTPServerTransport: class {
      constructor() {
        transportConstructorMock();
      }

      handleRequest = handleTransportRequestMock;
    },
  }),
);

vi.mock("@/lib/mcp/auth", () => ({
  authenticateMcpRequest: authenticateMcpRequestMock,
}));

vi.mock("@/lib/mcp/observability", () => ({
  summarizeMcpJsonRpcBody: summarizeMcpJsonRpcRequestMock,
  summarizeMcpJsonRpcRequest: summarizeMcpJsonRpcRequestMock,
}));

vi.mock("@/lib/mcp/server", () => ({
  createMcpServer: () => ({
    _registeredTools: { workspace_todo_create: {} },
    connect: connectMock,
  }),
}));

vi.mock("@/lib/security/user-mutation-rate-limit", () => ({
  checkUserMutationRateLimit: checkUserMutationRateLimitMock,
  USER_MUTATION_RATE_LIMIT_PERIOD_SECONDS: 60,
}));

vi.mock("@/lib/log/app-logger", () => ({ logAppEvent: vi.fn() }));
vi.mock("@/lib/log/oauth-debug", () => ({
  logOAuthDebug: vi.fn(),
  oauthDebugCorrelationId: () => "request-1",
}));
vi.mock("@/lib/api/routes/mcp-request-logging", () => ({
  logMcpTransportRequest: vi.fn(),
}));
vi.mock("@/lib/api/routes/mcp-response-inspection", () => ({
  inspectMcpResponse: inspectMcpResponseMock,
}));
vi.mock("@/lib/api/routes/mcp-response-bookkeeping", () => ({
  recordAndLogMcpResponse: recordAndLogMcpResponseMock,
}));
vi.mock("@/lib/oauth/grant-usage", () => ({
  scheduleOAuthGrantUsage: scheduleOAuthGrantUsageMock,
}));

function authenticatedUser() {
  return {
    authInfo: {
      clientId: "client-1",
      expiresAt: 1_900_000_000,
      extra: { userId: "user-1" },
      scopes: ["workspace.todo:write"],
      token: "token",
    },
  };
}

describe("MCP mutation rate limits", () => {
  beforeEach(() => {
    vi.resetModules();
    authenticateMcpRequestMock.mockReset();
    checkUserMutationRateLimitMock.mockReset();
    connectMock.mockReset().mockResolvedValue(undefined);
    handleTransportRequestMock.mockReset().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" },
      }),
    );
    inspectMcpResponseMock.mockReset().mockResolvedValue({
      hasError: false,
      responseBytes: 2,
      truncated: false,
    });
    recordAndLogMcpResponseMock.mockReset();
    scheduleOAuthGrantUsageMock.mockReset().mockResolvedValue(undefined);
    summarizeMcpJsonRpcRequestMock.mockReset().mockReturnValue({
      argumentKeys: ["title"],
      bodyKind: "jsonrpc-batch",
      methods: ["tools/call", "tools/call"],
      rpcCount: 2,
      toolCalls: [
        { argumentKeys: ["title"], toolName: "workspace_todo_create" },
        { argumentKeys: ["title"], toolName: "workspace_todo_create" },
      ],
      toolNames: ["workspace_todo_create", "workspace_todo_create"],
    });
    transportConstructorMock.mockReset();
    authenticateMcpRequestMock.mockResolvedValue(authenticatedUser());
  });

  it("counts duplicate mutation entries and rejects the whole batch before tools run", async () => {
    checkUserMutationRateLimitMock
      .mockResolvedValueOnce({ allowed: true })
      .mockResolvedValueOnce({ allowed: false, reason: "limited" });
    const request = new Request("https://life.example/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([
        {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "workspace_todo_create", arguments: { title: "A" } },
        },
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "workspace_todo_create", arguments: { title: "B" } },
        },
      ]),
    });

    const { handleMcpRequest } = await import(
      "@/lib/api/routes/mcp-request-handler"
    );
    const response = await handleMcpRequest(request);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("access-control-expose-headers")).toContain(
      "Retry-After",
    );
    await expect(response.json()).resolves.toEqual({
      error: "Rate limit exceeded",
    });
    expect(checkUserMutationRateLimitMock).toHaveBeenCalledTimes(2);
    expect(checkUserMutationRateLimitMock).toHaveBeenNthCalledWith(1, {
      action: "workspace.todo:write",
      host: "life.example",
      tier: "write",
      userId: "user-1",
    });
    expect(checkUserMutationRateLimitMock).toHaveBeenNthCalledWith(2, {
      action: "workspace.todo:write",
      host: "life.example",
      tier: "write",
      userId: "user-1",
    });
    expect(transportConstructorMock).not.toHaveBeenCalled();
    expect(connectMock).not.toHaveBeenCalled();
    expect(handleTransportRequestMock).not.toHaveBeenCalled();
    expect(authenticateMcpRequestMock).toHaveBeenCalledWith(request, [
      "workspace_todo_create",
    ]);
    expect(recordAndLogMcpResponseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "rate-limit-rejected",
        rpcSummary: expect.objectContaining({
          bodyKind: "jsonrpc-batch",
          rpcCount: 2,
          toolNames: ["workspace_todo_create", "workspace_todo_create"],
        }),
        status: 429,
      }),
    );
  });

  it("does not consume mutation budgets for read-only tools", async () => {
    summarizeMcpJsonRpcRequestMock.mockReturnValue({
      argumentKeys: [],
      bodyKind: "jsonrpc-single",
      methods: ["tools/call"],
      rpcCount: 1,
      toolCalls: [{ argumentKeys: [], toolName: "workspace_todo_list" }],
      toolNames: ["workspace_todo_list"],
    });
    const request = new Request("https://life.example/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "workspace_todo_list", arguments: {} },
      }),
    });

    const { handleMcpRequest } = await import(
      "@/lib/api/routes/mcp-request-handler"
    );
    const response = await handleMcpRequest(request);

    expect(response.status).toBe(200);
    expect(checkUserMutationRateLimitMock).not.toHaveBeenCalled();
    expect(transportConstructorMock).toHaveBeenCalledOnce();
    expect(connectMock).toHaveBeenCalledOnce();
    expect(handleTransportRequestMock).toHaveBeenCalledOnce();
    expect(handleTransportRequestMock).toHaveBeenCalledWith(
      request,
      expect.objectContaining({
        parsedBody: expect.objectContaining({
          method: "tools/call",
          params: expect.objectContaining({ name: "workspace_todo_list" }),
        }),
      }),
    );
  });

  it("propagates a HTTP 200 JSON-RPC tool error to usage and bookkeeping", async () => {
    inspectMcpResponseMock.mockResolvedValueOnce({
      hasError: true,
      responseBytes: 32,
      truncated: false,
    });
    handleTransportRequestMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 1,
          jsonrpc: "2.0",
          result: { isError: true },
        }),
        { headers: { "content-type": "application/json" } },
      ),
    );
    const request = new Request("https://life.example/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "workspace_todo_list", arguments: {} },
      }),
    });

    const { handleMcpRequest } = await import(
      "@/lib/api/routes/mcp-request-handler"
    );
    const response = await handleMcpRequest(request);

    expect(response.status).toBe(200);
    expect(scheduleOAuthGrantUsageMock).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "error" }),
    );
    expect(recordAndLogMcpResponseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hasError: true,
        inspectionTruncated: false,
        phase: "handled",
        status: 200,
      }),
    );
  });

  it("allows anonymous public catalog calls without invoking OAuth", async () => {
    const request = new Request("https://life.example/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "catalog_course_search", arguments: { query: "AI" } },
      }),
    });

    const { handleMcpRequest } = await import(
      "@/lib/api/routes/mcp-request-handler"
    );
    const response = await handleMcpRequest(request);

    expect(response.status).toBe(200);
    expect(authenticateMcpRequestMock).not.toHaveBeenCalled();
    expect(handleTransportRequestMock).toHaveBeenCalledWith(
      request,
      expect.objectContaining({
        authInfo: undefined,
        parsedBody: expect.objectContaining({
          params: expect.objectContaining({ name: "catalog_course_search" }),
        }),
      }),
    );
  });

  it("still challenges anonymous protected tool calls", async () => {
    authenticateMcpRequestMock.mockResolvedValue({
      authFailureDiagnostics: { authFailureKind: "missing_bearer" },
      response: new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 401,
      }),
    });
    const request = new Request("https://life.example/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "workspace_todo_list", arguments: {} },
      }),
    });

    const { handleMcpRequest } = await import(
      "@/lib/api/routes/mcp-request-handler"
    );
    const response = await handleMcpRequest(request);

    expect(response.status).toBe(401);
    expect(authenticateMcpRequestMock).toHaveBeenCalledWith(request, [
      "workspace_todo_list",
    ]);
    expect(handleTransportRequestMock).not.toHaveBeenCalled();
  });

  it("rejects anonymous oversized requests before authentication", async () => {
    const request = new Request("https://life.example/api/mcp", {
      method: "POST",
      headers: {
        "content-length": String(65 * 1024),
        "content-type": "application/json",
      },
      body: "{}",
    });

    const { handleMcpRequest } = await import(
      "@/lib/api/routes/mcp-request-handler"
    );
    const response = await handleMcpRequest(request);

    expect(response.status).toBe(413);
    expect(authenticateMcpRequestMock).not.toHaveBeenCalled();
    expect(transportConstructorMock).not.toHaveBeenCalled();
  });

  it("rejects authenticated oversized requests before auth or SDK handling", async () => {
    const request = new Request("https://life.example/api/mcp", {
      method: "POST",
      headers: {
        authorization: "Bearer token",
        "content-length": String(65 * 1024),
        "content-type": "application/json",
      },
      body: "{}",
    });

    const { handleMcpRequest } = await import(
      "@/lib/api/routes/mcp-request-handler"
    );
    const response = await handleMcpRequest(request);

    expect(response.status).toBe(413);
    expect(authenticateMcpRequestMock).not.toHaveBeenCalled();
    expect(transportConstructorMock).not.toHaveBeenCalled();
    expect(recordAndLogMcpResponseMock).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "body-rejected", status: 413 }),
    );
  });

  it("records transport exceptions before rethrowing them", async () => {
    const transportError = new TypeError("sensitive detail");
    transportError.name = "ApiKeyABC123";
    connectMock.mockRejectedValueOnce(transportError);
    const request = new Request("https://life.example/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "tools/list",
      }),
    });

    const { handleMcpRequest } = await import(
      "@/lib/api/routes/mcp-request-handler"
    );
    await expect(handleMcpRequest(request)).rejects.toThrow("sensitive detail");

    expect(recordAndLogMcpResponseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        errorName: "TypeError",
        phase: "error",
        status: 500,
      }),
    );
    expect(
      JSON.stringify(recordAndLogMcpResponseMock.mock.calls),
    ).not.toContain("sensitive detail");
  });
});
