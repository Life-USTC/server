import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authenticateMcpRequestMock,
  checkUserMutationRateLimitMock,
  connectMock,
  handleTransportRequestMock,
  recordAndLogMcpResponseMock,
  summarizeMcpJsonRpcRequestMock,
  transportConstructorMock,
} = vi.hoisted(() => ({
  authenticateMcpRequestMock: vi.fn(),
  checkUserMutationRateLimitMock: vi.fn(),
  connectMock: vi.fn(),
  handleTransportRequestMock: vi.fn(),
  recordAndLogMcpResponseMock: vi.fn(),
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
  summarizeMcpJsonRpcRequest: summarizeMcpJsonRpcRequestMock,
}));

vi.mock("@/lib/mcp/server", () => ({
  createMcpServer: () => ({
    _registeredTools: { create_my_todo: {} },
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
vi.mock("@/lib/api/routes/mcp-response-bookkeeping", () => ({
  recordAndLogMcpResponse: recordAndLogMcpResponseMock,
}));

function authenticatedUser() {
  return {
    authInfo: {
      clientId: "client-1",
      expiresAt: 1_900_000_000,
      extra: { userId: "user-1" },
      scopes: ["todo:write"],
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
    recordAndLogMcpResponseMock.mockReset();
    summarizeMcpJsonRpcRequestMock.mockReset().mockResolvedValue({
      methodCounts: { "tools/call": 2 },
      toolCallCounts: { create_my_todo: 2 },
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
          params: { name: "create_my_todo", arguments: { title: "A" } },
        },
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "create_my_todo", arguments: { title: "B" } },
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
      action: "todo:write",
      host: "life.example",
      tier: "write",
      userId: "user-1",
    });
    expect(checkUserMutationRateLimitMock).toHaveBeenNthCalledWith(2, {
      action: "todo:write",
      host: "life.example",
      tier: "write",
      userId: "user-1",
    });
    expect(transportConstructorMock).not.toHaveBeenCalled();
    expect(connectMock).not.toHaveBeenCalled();
    expect(handleTransportRequestMock).not.toHaveBeenCalled();
    expect(recordAndLogMcpResponseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "rate-limit-rejected",
        rpcSummary: expect.objectContaining({
          toolCallCounts: { create_my_todo: 2 },
        }),
        status: 429,
      }),
    );
  });

  it("does not consume mutation budgets for read-only tools", async () => {
    summarizeMcpJsonRpcRequestMock.mockResolvedValue({
      methodCounts: { "tools/call": 1 },
      toolCallCounts: { list_my_todos: 1 },
    });
    const request = new Request("https://life.example/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "list_my_todos", arguments: {} },
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
  });
});
