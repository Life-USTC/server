import type { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authenticateMcpRequestMock,
  checkUserMutationRateLimitMock,
  connectMock,
  handleTransportRequestMock,
  inspectMcpResponseMock,
  logAppEventMock,
  recordAndLogMcpResponseMock,
  scheduleOAuthGrantUsageMock,
  sendMock,
  summarizeMcpJsonRpcRequestMock,
  transportConstructorMock,
} = vi.hoisted(() => ({
  authenticateMcpRequestMock: vi.fn(),
  checkUserMutationRateLimitMock: vi.fn(),
  connectMock: vi.fn(),
  handleTransportRequestMock: vi.fn(),
  inspectMcpResponseMock: vi.fn(),
  logAppEventMock: vi.fn(),
  recordAndLogMcpResponseMock: vi.fn(),
  scheduleOAuthGrantUsageMock: vi.fn(),
  sendMock: vi.fn(),
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
      send = sendMock;
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

vi.mock("@/lib/log/app-logger", () => ({ logAppEvent: logAppEventMock }));
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

function mcpRequest(body: unknown) {
  return new Request("https://life.example/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer token",
    },
    body: JSON.stringify(body),
  });
}

function toolCall(id: string | number, name = "workspace_todo_list") {
  return {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: {} },
  };
}

function connectedTransport(): WebStandardStreamableHTTPServerTransport {
  const transport = connectMock.mock.calls[0]?.[0];
  expect(transport).toBeDefined();
  return transport;
}

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
    logAppEventMock.mockReset();
    sendMock.mockReset().mockResolvedValue(undefined);
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

  it("mcp.parsed-body-reuse", async () => {
    const { handleMcpRequest } = await import(
      "@/lib/api/routes/mcp-request-handler"
    );
    const body = JSON.stringify([
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
    ]);
    const request = new Request("https://life.example/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    const clone = vi.spyOn(request, "clone");
    const json = vi.spyOn(request, "json");
    const parse = vi.spyOn(JSON, "parse");
    checkUserMutationRateLimitMock.mockResolvedValue({ allowed: true });
    try {
      expect((await handleMcpRequest(request)).status).toBe(200);
      const bodyParses = parse.mock.calls.flatMap((args, index) =>
        args[0] === body ? [parse.mock.results[index]?.value] : [],
      );
      expect(bodyParses).toHaveLength(1);
      const parsedBody = bodyParses[0];
      expect(summarizeMcpJsonRpcRequestMock).toHaveBeenCalledOnce();
      expect(summarizeMcpJsonRpcRequestMock.mock.calls[0]?.[0]).toBe(
        parsedBody,
      );
      expect(handleTransportRequestMock.mock.calls[0]?.[1].parsedBody).toBe(
        parsedBody,
      );
      expect(authenticateMcpRequestMock).toHaveBeenCalledWith(request, [
        "workspace_todo_create",
      ]);
      expect(checkUserMutationRateLimitMock).toHaveBeenCalledTimes(2);
      expect(
        authenticateMcpRequestMock.mock.invocationCallOrder[0],
      ).toBeLessThan(
        checkUserMutationRateLimitMock.mock.invocationCallOrder[0] ?? 0,
      );
      expect(
        checkUserMutationRateLimitMock.mock.invocationCallOrder[1],
      ).toBeLessThan(
        handleTransportRequestMock.mock.invocationCallOrder[0] ?? 0,
      );
      expect(clone).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();
    } finally {
      parse.mockRestore();
      clone.mockRestore();
      json.mockRestore();
    }
  });

  it("mcp.mutation-rate-limits", async () => {
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

    expect(scheduleOAuthGrantUsageMock).toHaveBeenCalledTimes(2);
    expect(
      scheduleOAuthGrantUsageMock.mock.calls.map(([input]) => input.outcome),
    ).toEqual(["error", "error"]);

    for (const reason of ["limited", "unavailable"] as const) {
      checkUserMutationRateLimitMock
        .mockReset()
        .mockResolvedValue({ allowed: false, reason });
      const importRequest = new Request("https://life.example/api/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name: "workspace_subscription_import",
            arguments: { semester: "2026" },
          },
        }),
      });
      const importResponse = await handleMcpRequest(importRequest);
      expect(importResponse.status).toBe(reason === "limited" ? 429 : 503);
      expect(importResponse.headers.get("retry-after")).toBe("60");
      expect(checkUserMutationRateLimitMock).toHaveBeenCalledExactlyOnceWith({
        action: "workspace.subscription:batch-write",
        host: "life.example",
        tier: "batch",
        userId: "user-1",
      });
      expect(handleTransportRequestMock).not.toHaveBeenCalled();
    }
    // Exact selected GraphQL mutation fields own their resolver budgets.
    checkUserMutationRateLimitMock.mockClear();
    const graphqlRequest = new Request("https://life.example/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "graphql_operation_run",
          arguments: {
            operationId: "workspace.todo.create.v1",
            confirmed: true,
          },
        },
      }),
    });
    expect((await handleMcpRequest(graphqlRequest)).status).toBe(200);
    expect(checkUserMutationRateLimitMock).not.toHaveBeenCalled();
    expect(handleTransportRequestMock).toHaveBeenCalledOnce();
  });

  it("mcp.rate-limit-accuracy-boundary", async () => {
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
    for (const header of [
      "ratelimit-remaining",
      "ratelimit-reset",
      "x-ratelimit-remaining",
      "x-ratelimit-reset",
    ])
      expect(response.headers.has(header)).toBe(false);

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
    handleTransportRequestMock.mockImplementationOnce(async () => {
      const message = {
        id: 1,
        jsonrpc: "2.0" as const,
        result: { isError: true },
      };
      await connectedTransport().send(message);
      return new Response(JSON.stringify(message), {
        headers: { "content-type": "application/json" },
      });
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

  it("records a completed large success before send while inspection stays unknown", async () => {
    inspectMcpResponseMock.mockResolvedValueOnce({
      hasError: false,
      responseBytes: 65_536,
      truncated: true,
    });
    const message = {
      id: 1,
      jsonrpc: "2.0" as const,
      result: { content: [{ type: "text", text: "x".repeat(70_000) }] },
    };
    const options = { relatedRequestId: 1 };
    handleTransportRequestMock.mockImplementationOnce(async () => {
      await connectedTransport().send(message, options);
      return new Response("large response");
    });
    const { handleMcpRequest } = await import(
      "@/lib/api/routes/mcp-request-handler"
    );
    expect((await handleMcpRequest(mcpRequest(toolCall(1)))).status).toBe(200);
    expect(scheduleOAuthGrantUsageMock).toHaveBeenCalledExactlyOnceWith({
      userId: "user-1",
      clientId: "client-1",
      grantId: undefined,
      feature: "workspace.todo",
      action: "read",
      channel: "mcp",
      outcome: "success",
    });
    expect(
      scheduleOAuthGrantUsageMock.mock.invocationCallOrder[0],
    ).toBeLessThan(sendMock.mock.invocationCallOrder[0] ?? 0);
    expect(sendMock).toHaveBeenCalledExactlyOnceWith(message, options);
    expect(sendMock.mock.contexts[0]).toBe(connectedTransport());
    expect(recordAndLogMcpResponseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hasError: false,
        inspectionTruncated: true,
        responseBytes: 65_536,
      }),
    );
  });

  it("does not infer success from HTTP 200 before a delayed final result", async () => {
    inspectMcpResponseMock.mockResolvedValueOnce({
      hasError: false,
      responseBytes: 0,
      truncated: true,
    });
    const { handleMcpRequest } = await import(
      "@/lib/api/routes/mcp-request-handler"
    );
    expect((await handleMcpRequest(mcpRequest(toolCall(1)))).status).toBe(200);
    expect(scheduleOAuthGrantUsageMock).not.toHaveBeenCalled();
    const transport = connectedTransport();
    await transport.send(
      { jsonrpc: "2.0", method: "notifications/progress", params: {} },
      { relatedRequestId: 1 },
    );
    expect(scheduleOAuthGrantUsageMock).not.toHaveBeenCalled();
    await transport.send({ jsonrpc: "2.0", id: 1, result: {} });
    await transport.send({ jsonrpc: "2.0", id: 1, result: {} });
    expect(scheduleOAuthGrantUsageMock).toHaveBeenCalledOnce();
    expect(scheduleOAuthGrantUsageMock).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "success" }),
    );
  });

  it("attributes out-of-order batch results by typed ID and excludes bridge and lifecycle calls", async () => {
    checkUserMutationRateLimitMock.mockResolvedValue({ allowed: true });
    handleTransportRequestMock.mockImplementationOnce(async () => {
      const transport = connectedTransport();
      await transport.send({
        jsonrpc: "2.0",
        id: "1",
        result: { isError: true },
      });
      await transport.send({
        jsonrpc: "2.0",
        id: 3,
        error: { code: -32603, message: "failed" },
      });
      await transport.send({ jsonrpc: "2.0", id: 1, result: {} });
      await transport.send({ jsonrpc: "2.0", id: 4, result: {} });
      await transport.send({ jsonrpc: "2.0", id: 5, result: {} });
      await transport.send({ jsonrpc: "2.0", id: 6, result: {} });
      return new Response("batch");
    });
    const { handleMcpRequest } = await import(
      "@/lib/api/routes/mcp-request-handler"
    );
    await handleMcpRequest(
      mcpRequest([
        toolCall(1),
        toolCall("1"),
        toolCall(3, "workspace_todo_create"),
        toolCall(4, "graphql_operation_run"),
        toolCall(5, "catalog_course_search"),
        { jsonrpc: "2.0", id: 6, method: "tools/list" },
        {
          jsonrpc: "2.0",
          method: "tools/call",
          params: { name: "workspace_todo_list" },
        },
      ]),
    );
    expect(
      scheduleOAuthGrantUsageMock.mock.calls.map(([input]) => ({
        feature: input.feature,
        action: input.action,
        outcome: input.outcome,
      })),
    ).toEqual([
      { feature: "workspace.todo", action: "read", outcome: "error" },
      { feature: "workspace.todo", action: "write", outcome: "error" },
      { feature: "workspace.todo", action: "read", outcome: "success" },
    ]);
    expect(logAppEventMock).not.toHaveBeenCalledWith(
      "warn",
      expect.anything(),
      expect.anything(),
    );
  });

  it("settles only outstanding calls when handling throws after a completed result", async () => {
    const failure = new Error("transport failed");
    handleTransportRequestMock.mockImplementationOnce(async () => {
      await connectedTransport().send({ jsonrpc: "2.0", id: 1, result: {} });
      throw failure;
    });
    const { handleMcpRequest } = await import(
      "@/lib/api/routes/mcp-request-handler"
    );
    await expect(
      handleMcpRequest(mcpRequest([toolCall(1), toolCall(2)])),
    ).rejects.toBe(failure);
    await connectedTransport().send({ jsonrpc: "2.0", id: 2, result: {} });
    expect(
      scheduleOAuthGrantUsageMock.mock.calls.map(([input]) => input.outcome),
    ).toEqual(["success", "error"]);
  });

  it("records direct HTTP rejection as errors without changing its response", async () => {
    handleTransportRequestMock.mockResolvedValueOnce(
      new Response("unsupported accept", { status: 406 }),
    );
    const { handleMcpRequest } = await import(
      "@/lib/api/routes/mcp-request-handler"
    );
    const response = await handleMcpRequest(
      mcpRequest([toolCall(1), toolCall(2)]),
    );
    expect(response.status).toBe(406);
    await expect(response.text()).resolves.toBe("unsupported accept");
    expect(
      scheduleOAuthGrantUsageMock.mock.calls.map(([input]) => input.outcome),
    ).toEqual(["error", "error"]);
  });

  it("settles direct HTTP failures once even if later response bookkeeping throws", async () => {
    handleTransportRequestMock.mockResolvedValueOnce(
      new Response("invalid protocol", { status: 400 }),
    );
    const failure = new Error("inspection failed");
    inspectMcpResponseMock.mockRejectedValueOnce(failure);
    const { handleMcpRequest } = await import(
      "@/lib/api/routes/mcp-request-handler"
    );
    await expect(
      handleMcpRequest(mcpRequest([toolCall(1), toolCall(2)])),
    ).rejects.toBe(failure);
    expect(
      scheduleOAuthGrantUsageMock.mock.calls.map(([input]) => input.outcome),
    ).toEqual(["error", "error"]);
  });

  it("preserves a send rejection without rewriting or recounting its completed operation", async () => {
    const failure = new Error("delivery failed");
    sendMock.mockRejectedValueOnce(failure);
    handleTransportRequestMock.mockImplementationOnce(async () => {
      await connectedTransport().send({ jsonrpc: "2.0", id: 1, result: {} });
      return new Response("unreachable");
    });
    const { handleMcpRequest } = await import(
      "@/lib/api/routes/mcp-request-handler"
    );
    await expect(handleMcpRequest(mcpRequest(toolCall(1)))).rejects.toBe(
      failure,
    );
    expect(scheduleOAuthGrantUsageMock).toHaveBeenCalledOnce();
    expect(scheduleOAuthGrantUsageMock).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "success" }),
    );
  });

  it.each(["workspace_todo_create", "workspace_todo_list"])(
    "rejects duplicate batch IDs before any auth, rate limit, or dispatch: %s",
    async (secondTool) => {
      const { handleMcpRequest } = await import(
        "@/lib/api/routes/mcp-request-handler"
      );
      const response = await handleMcpRequest(
        mcpRequest([
          toolCall(1, "workspace_todo_create"),
          toolCall(1, secondTool),
        ]),
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "Invalid Request" },
      });
      expect(authenticateMcpRequestMock).not.toHaveBeenCalled();
      expect(checkUserMutationRateLimitMock).not.toHaveBeenCalled();
      expect(transportConstructorMock).not.toHaveBeenCalled();
      expect(connectMock).not.toHaveBeenCalled();
      expect(handleTransportRequestMock).not.toHaveBeenCalled();
      expect(scheduleOAuthGrantUsageMock).not.toHaveBeenCalled();
      expect(recordAndLogMcpResponseMock).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: "body-rejected",
          status: 400,
        }),
      );
    },
  );

  it.each([false, true])(
    "usage failure preserves the response when logging also fails: %s",
    async (loggingFails) => {
      if (loggingFails) {
        logAppEventMock.mockImplementation((_level, event) => {
          if (event === "mcp.oauth_usage.failed")
            throw new Error("logger failed");
        });
      }
      scheduleOAuthGrantUsageMock.mockRejectedValueOnce(
        new Error("database failed"),
      );
      handleTransportRequestMock.mockImplementationOnce(async () => {
        await connectedTransport().send({ jsonrpc: "2.0", id: 1, result: {} });
        return new Response("completed");
      });
      const { handleMcpRequest } = await import(
        "@/lib/api/routes/mcp-request-handler"
      );
      expect((await handleMcpRequest(mcpRequest(toolCall(1)))).status).toBe(
        200,
      );
      expect(sendMock).toHaveBeenCalledOnce();
      expect(scheduleOAuthGrantUsageMock).toHaveBeenCalledOnce();
      expect(logAppEventMock).toHaveBeenCalledWith(
        "error",
        "mcp.oauth_usage.failed",
        { errorName: "Error" },
      );
    },
  );

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
