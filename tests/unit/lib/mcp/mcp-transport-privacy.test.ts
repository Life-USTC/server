import { afterEach, expect, it, vi } from "vitest";

const { emitLog, connect, handleRequest } = vi.hoisted(() => ({
  emitLog: vi.fn(),
  connect: vi.fn(),
  handleRequest: vi.fn(),
}));
// Only external identity, SDK execution, usage persistence and log/analytics sinks
// are replaced. Body parsing, summaries, error sanitization and both loggers run.
vi.mock("@/lib/db/prisma", () => ({
  prisma: {},
  getPrisma: vi.fn(() => {
    throw new Error("No database in unit tests");
  }),
}));
vi.mock("@/lib/security/user-mutation-rate-limit", () => ({
  checkUserMutationRateLimit: vi.fn(),
  USER_MUTATION_RATE_LIMIT_PERIOD_SECONDS: 60,
}));
vi.mock("@/lib/log/app-log-emitter", () => ({
  emitLog,
  setRuntimeIssueRecorder: vi.fn(),
}));
vi.mock("@/lib/metrics/analytics-engine", () => ({
  writeMcpTransportAnalytics: vi.fn(),
}));
vi.mock("@/lib/oauth/grant-usage", () => ({
  scheduleOAuthGrantUsage: vi.fn(),
}));
vi.mock("@/lib/mcp/auth", () => ({
  authenticateMcpRequest: vi.fn(async () => ({
    authInfo: {
      token: "BEARER_SECRET",
      clientId: "test-client",
      scopes: ["workspace.todo:read"],
      extra: { userId: "test-user" },
    },
  })),
}));
vi.mock("@/lib/mcp/server", () => ({
  createMcpServer: () => ({
    _registeredTools: { workspace_todo_list: {} },
    connect,
  }),
}));
vi.mock("@modelcontextprotocol/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@modelcontextprotocol/server")>()),
  createMcpHandler: (
    factory: () => { connect(transport: unknown): Promise<void> },
  ) => ({
    async fetch(...args: unknown[]) {
      await factory().connect({ send: vi.fn(async () => undefined) });
      return handleRequest(...args);
    },
  }),
}));

import { handleMcpRequest } from "@/lib/api/routes/mcp-request-handler";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it("mcp.transport-observability", async () => {
  vi.stubEnv("OAUTH_DEBUG_LOGGING", "verbose");
  vi.stubEnv("LOG_LEVEL", "debug");
  vi.stubEnv("NODE_ENV", "test");
  const secretError = new TypeError("EXCEPTION_SECRET");
  secretError.name = "ERROR_NAME_SECRET";
  connect.mockResolvedValueOnce(undefined).mockRejectedValueOnce(secretError);
  handleRequest.mockResolvedValue(
    new Response(
      JSON.stringify({ jsonrpc: "2.0", id: 1, result: { isError: false } }),
      { headers: { "content-type": "application/json" } },
    ),
  );
  const request = () =>
    new Request("https://life.example/api/mcp?private=QUERY_SECRET", {
      method: "POST",
      headers: {
        authorization: "Bearer BEARER_SECRET",
        cookie: "session=COOKIE_SECRET",
        "content-type": "application/json; private=CONTENT_TYPE_SECRET",
        "user-agent": "USER_AGENT_SECRET",
        "mcp-session-id": "SESSION_SECRET",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "workspace_todo_list",
          arguments: {
            query: "ARGUMENT_SECRET",
            PRIVATE_KEY_SECRET: "PRIVATE_VALUE_SECRET",
          },
        },
      }),
    });
  expect((await handleMcpRequest(request())).status).toBe(200);
  await expect(handleMcpRequest(request())).rejects.toBe(secretError);
  const records = emitLog.mock.calls.map((call) => call[2]);
  for (const message of [
    "mcp.transport.request",
    "mcp.transport.rpc",
    "mcp.transport.response",
    "mcp.request",
    "mcp.rpc",
    "mcp.response",
  ])
    expect(
      records.some((record) => record.message === message),
      message,
    ).toBe(true);
  expect(records).toContainEqual(
    expect.objectContaining({
      message: "mcp.transport.response",
      phase: "error",
      errorName: "TypeError",
      status: 500,
      rpcCount: 1,
      rpcToolCount: 1,
    }),
  );
  const output = JSON.stringify(emitLog.mock.calls);
  for (const secret of [
    "BEARER_SECRET",
    "COOKIE_SECRET",
    "EXCEPTION_SECRET",
    "ERROR_NAME_SECRET",
    "QUERY_SECRET",
    "CONTENT_TYPE_SECRET",
    "USER_AGENT_SECRET",
    "SESSION_SECRET",
    "ARGUMENT_SECRET",
    "PRIVATE_KEY_SECRET",
    "PRIVATE_VALUE_SECRET",
  ])
    expect(output).not.toContain(secret);
});

it("records bounded handshake categories when authentication rejects", async () => {
  const { authenticateMcpRequest } = await import("@/lib/mcp/auth");
  vi.stubEnv("LOG_LEVEL", "debug");
  vi.stubEnv("NODE_ENV", "test");
  vi.mocked(authenticateMcpRequest).mockResolvedValueOnce({
    response: new Response("Unauthorized", { status: 401 }),
    authFailureDiagnostics: {
      authFailureKind: "upstream_auth_rejected",
      authHeaderKind: "bearer",
      authTokenFormat: "jwt",
    },
  });
  const response = await handleMcpRequest(
    new Request("https://life.example/api/mcp", {
      method: "POST",
      headers: {
        authorization: "Bearer BEARER_SECRET",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: {
            name: "CLIENT_NAME_SECRET",
            version: "CLIENT_VERSION_SECRET",
          },
        },
      }),
    }),
  );
  expect(response.status).toBe(401);
  const records = emitLog.mock.calls.map((call) => call[2]);
  expect(records).toContainEqual(
    expect.objectContaining({
      message: "mcp.transport.response",
      phase: "auth-rejected",
      rpcMethod: "initialize",
      protocolFamily: "legacy",
    }),
  );
  expect(handleRequest).not.toHaveBeenCalled();
  for (const secret of [
    "BEARER_SECRET",
    "CLIENT_NAME_SECRET",
    "CLIENT_VERSION_SECRET",
  ])
    expect(JSON.stringify(emitLog.mock.calls)).not.toContain(secret);
});

it("never logs client-controlled protocol or method strings", async () => {
  vi.stubEnv("LOG_LEVEL", "debug");
  vi.stubEnv("NODE_ENV", "test");
  connect.mockResolvedValue(undefined);
  handleRequest.mockResolvedValue(
    new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32601, message: "Method not found" },
      }),
      { status: 400, headers: { "content-type": "application/json" } },
    ),
  );
  const response = await handleMcpRequest(
    new Request("https://life.example/api/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "mcp-protocol-version": "HEADER_SECRET",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "METHOD_SECRET",
        params: {
          _meta: {
            "io.modelcontextprotocol/protocolVersion": "VERSION_SECRET",
          },
        },
      }),
    }),
  );
  expect(response.status).toBe(400);
  const records = emitLog.mock.calls.map((call) => call[2]);
  expect(records).toContainEqual(
    expect.objectContaining({
      message: "mcp.transport.response",
      rpcMethod: "other",
      protocolFamily: "other",
    }),
  );
  for (const secret of ["METHOD_SECRET", "VERSION_SECRET", "HEADER_SECRET"])
    expect(JSON.stringify(emitLog.mock.calls)).not.toContain(secret);
});
