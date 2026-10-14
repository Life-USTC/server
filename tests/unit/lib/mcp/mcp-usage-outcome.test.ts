import { McpServer, ProtocolError } from "@modelcontextprotocol/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as z from "zod";
import { handleMcpRequest } from "@/lib/api/routes/mcp-request-handler";
import * as inspection from "@/lib/api/routes/mcp-response-inspection";
import { installMcpToolDescriptorDefaults } from "@/lib/mcp/tool-descriptors";
import { createDeferred } from "../../../shared/deferred";

const { authenticateMock, createServerMock, rateLimitMock, scheduleUsageMock } =
  vi.hoisted(() => ({
    authenticateMock: vi.fn(),
    createServerMock: vi.fn(),
    rateLimitMock: vi.fn(),
    scheduleUsageMock: vi.fn(),
  }));

vi.mock("@/lib/mcp/auth", () => ({ authenticateMcpRequest: authenticateMock }));
vi.mock("@/lib/mcp/server", () => ({ createMcpServer: createServerMock }));
vi.mock("@/lib/oauth/grant-usage", () => ({
  scheduleOAuthGrantUsage: scheduleUsageMock,
}));
vi.mock("@/lib/security/user-mutation-rate-limit", () => ({
  checkUserMutationRateLimit: rateLimitMock,
  USER_MUTATION_RATE_LIMIT_PERIOD_SECONDS: 60,
}));
vi.mock("@/lib/mcp/feature-observability", () => ({
  observeMcpFeature: (
    _name: string,
    _args: unknown,
    _extra: unknown,
    work: () => unknown,
  ) => work(),
}));
vi.mock("@/lib/log/app-logger", () => ({ logAppEvent: vi.fn() }));
vi.mock("@/lib/log/oauth-debug", () => ({
  logOAuthDebug: vi.fn(),
  oauthDebugCorrelationId: () => "real-sdk-usage",
}));
vi.mock("@/lib/api/routes/mcp-request-logging", () => ({
  logMcpTransportRequest: vi.fn(),
}));
vi.mock("@/lib/api/routes/mcp-response-bookkeeping", () => ({
  recordAndLogMcpResponse: vi.fn(),
}));

type RpcMessage = {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: {
    isError?: boolean;
    content?: { type: string; text: string }[];
    structuredContent?: Record<string, unknown>;
    [key: string]: unknown;
  };
  error?: { code: number; message: string; data?: unknown };
};
type Usage = {
  userId: string;
  clientId: string;
  grantId: string;
  feature: string;
  action: "read" | "write";
  channel: "mcp";
  outcome: "success" | "error";
};
const responseMetadata = {
  resultType: "complete",
  _meta: {
    "io.modelcontextprotocol/serverInfo": {
      name: "usage-regression",
      version: "1",
    },
  },
};
const readSuccess: Usage = {
  userId: "reader",
  clientId: "client",
  grantId: "grant",
  feature: "workspace.todo",
  action: "read",
  channel: "mcp",
  outcome: "success",
};
const usage = () =>
  scheduleUsageMock.mock.calls.map(([input]) => ({ ...input }));
const call = (
  id: number | string,
  name: string,
  args: Record<string, unknown> = {},
) => ({
  jsonrpc: "2.0",
  id,
  method: "tools/call",
  params: { name, arguments: args },
});
const textResult = (text: string) => ({
  content: [{ type: "text" as const, text }],
});

/** Real SDK server and HTTP transport, without listening sockets. The only
 * factory substitution is this test's tool catalog; SDK validation and replies,
 * bounded inspection, request parsing, tool-to-usage mapping and CORS remain
 * genuine. Authentication and scope enforcement are mocked boundaries. */
async function withSdk(
  register: (server: McpServer) => void,
  work: (
    post: (
      body: unknown,
      onMessage?: (message: RpcMessage) => void,
    ) => Promise<{
      response: Response;
      consumed: Promise<{
        text: string;
        messages: RpcMessage[];
        usageAtEof: Usage[];
      }>;
    }>,
  ) => Promise<void>,
) {
  const servers: McpServer[] = [];
  const pending: Promise<unknown>[] = [];
  createServerMock.mockImplementation(() => {
    const server = new McpServer({ name: "usage-regression", version: "1" });
    servers.push(server);
    register(server);
    return server;
  });
  const errors: unknown[] = [];
  try {
    await import("@/lib/mcp/auth");
    await work(async (body, onMessage) => {
      const operation = handleMcpRequest(
        new Request("https://life.example/api/mcp", {
          method: "POST",
          headers: {
            authorization: "Bearer fixture-token",
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
            "mcp-protocol-version": "2026-07-28",
            "mcp-method": (body as { method?: string }).method ?? "tools/call",
            ...((body as { params?: { name?: string } }).params?.name
              ? {
                  "mcp-name": (body as { params: { name: string } }).params
                    .name,
                }
              : {}),
          },
          body: JSON.stringify(
            Array.isArray(body)
              ? body
              : {
                  ...(body as object),
                  params: {
                    ...(body as { params?: object }).params,
                    _meta: {
                      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
                      "io.modelcontextprotocol/clientInfo": {
                        name: "usage-regression",
                        version: "1",
                      },
                      "io.modelcontextprotocol/clientCapabilities": {},
                    },
                  },
                },
          ),
        }),
      );
      pending.push(operation);
      const response = await operation;
      const consumed = (async () => {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let text = "";
        let pendingLines = "";
        const isSse = response.headers
          .get("content-type")
          ?.includes("text/event-stream");
        const observe = (chunk: string) => {
          text += chunk;
          if (!isSse || !onMessage) return;
          pendingLines += chunk;
          let newline = pendingLines.indexOf("\n");
          while (newline >= 0) {
            const line = pendingLines.slice(0, newline).replace(/\r$/, "");
            pendingLines = pendingLines.slice(newline + 1);
            if (line.startsWith("data:"))
              onMessage(JSON.parse(line.slice(5).trim()));
            newline = pendingLines.indexOf("\n");
          }
        };
        try {
          if (reader) {
            while (true) {
              const chunk = await reader.read();
              if (chunk.done) break;
              observe(decoder.decode(chunk.value, { stream: true }));
            }
            observe(decoder.decode());
          }
          // Capture at the genuine consumer EOF, before any later test await.
          const usageAtEof = usage();
          const messages: RpcMessage[] = isSse
            ? text
                .split(/\r?\n/)
                .filter((line) => line.startsWith("data:"))
                .map((line) => JSON.parse(line.slice(5).trim()))
            : text
              ? [JSON.parse(text)]
              : [];
          return { text, messages, usageAtEof };
        } finally {
          reader?.releaseLock();
        }
      })();
      pending.push(consumed);
      void consumed.catch(() => undefined);
      return { response, consumed };
    });
  } catch (error) {
    errors.push(error);
  } finally {
    // Deferred scenarios release their own gates before reaching this join.
    // Preserve real callbacks and response bodies instead of canceling on assert.
    for (const outcome of await Promise.allSettled(pending))
      if (outcome.status === "rejected" && !errors.includes(outcome.reason))
        errors.push(outcome.reason);
    for (const server of servers)
      try {
        await server.close();
      } catch (error) {
        errors.push(error);
      }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length)
    throw new AggregateError(errors, "SDK usage regression failed");
}

beforeEach(() => {
  vi.clearAllMocks();
  createServerMock.mockReset();
  authenticateMock.mockReset().mockResolvedValue({
    authInfo: {
      clientId: "client",
      token: "fixture-token",
      scopes: [
        "workspace.todo:read",
        "workspace.todo:write",
        "workspace.calendar:read",
      ],
      extra: { userId: "reader", grantId: "grant" },
    },
  });
  rateLimitMock.mockReset().mockResolvedValue({ allowed: true });
  scheduleUsageMock.mockReset().mockResolvedValue(undefined);
});

describe("MCP OAuth usage from genuine SDK outcomes", () => {
  it("keeps a full large successful response and registers one read by consumer EOF", async () => {
    const payload = "calendar-event-".repeat(8_000);
    const callback = vi.fn(async () => ({
      ...textResult(payload),
      structuredContent: { payload },
    }));
    const inspect = vi.spyOn(inspection, "inspectMcpResponse");
    await withSdk(
      (server) => {
        server.registerTool("workspace_todo_list", {}, callback);
      },
      async (post) => {
        const { response, consumed } = await post(
          call(1, "workspace_todo_list"),
        );
        expect(response.status).toBe(200);
        const body = await consumed;
        expect(new TextEncoder().encode(body.text).byteLength).toBeGreaterThan(
          64 * 1024,
        );
        expect(body.messages).toEqual([
          {
            jsonrpc: "2.0",
            id: 1,
            result: {
              ...responseMetadata,
              content: [{ type: "text", text: payload }],
              structuredContent: { payload },
            },
          },
        ]);
        expect(callback).toHaveBeenCalledOnce();
        await expect(inspect.mock.results[0].value).resolves.toMatchObject({
          truncated: true,
        });
        expect(body.usageAtEof).toEqual([readSuccess]);
        expect(usage()).toEqual([readSuccess]);
      },
    );
  });

  it("keeps a completed protocol success when domain fields report absence", async () => {
    const result = {
      ...textResult('{"success":false,"found":false}'),
      structuredContent: { success: false, found: false },
    };
    await withSdk(
      (server) => {
        server.registerTool("workspace_todo_list", {}, async () => result);
      },
      async (post) => {
        const { consumed } = await post(call(1, "workspace_todo_list"));
        const body = await consumed;
        expect(body.messages).toEqual([
          { jsonrpc: "2.0", id: 1, result: { ...result, ...responseMetadata } },
        ]);
        expect(body.usageAtEof).toEqual([readSuccess]);
        expect(usage()).toEqual([readSuccess]);
      },
    );
  });

  it("counts SDK input validation failure without invoking the tool", async () => {
    const callback = vi.fn(async () => textResult("unreachable"));
    await withSdk(
      (server) => {
        server.registerTool(
          "workspace_todo_list",
          { inputSchema: { limit: z.number() } },
          callback,
        );
      },
      async (post) => {
        const { consumed } = await post(
          call(1, "workspace_todo_list", { limit: "invalid" }),
        );
        const body = await consumed;
        expect(callback).not.toHaveBeenCalled();
        expect(body.messages).toEqual([
          {
            jsonrpc: "2.0",
            id: 1,
            result: {
              ...responseMetadata,
              isError: true,
              content: [
                {
                  type: "text",
                  text: expect.stringContaining("Input validation error"),
                },
              ],
            },
          },
        ]);
        expect(body.usageAtEof).toEqual([{ ...readSuccess, outcome: "error" }]);
      },
    );
  });

  it("counts a thrown real callback as a failed write", async () => {
    const callback = vi.fn(async () => {
      throw new Error("write failed");
    });
    await withSdk(
      (server) => {
        server.registerTool("workspace_todo_create", {}, callback);
      },
      async (post) => {
        const { consumed } = await post(call(1, "workspace_todo_create"));
        const body = await consumed;
        expect(callback).toHaveBeenCalledOnce();
        expect(body.messages).toEqual([
          {
            jsonrpc: "2.0",
            id: 1,
            result: {
              ...responseMetadata,
              isError: true,
              content: [{ type: "text", text: "write failed" }],
            },
          },
        ]);
        expect(body.usageAtEof).toEqual([
          { ...readSuccess, action: "write", outcome: "error" },
        ]);
        expect(usage()).toEqual(body.usageAtEof);
      },
    );
  });

  it("counts the application's descriptor rejection after a successful callback", async () => {
    const callback = vi.fn(async () => ({
      ...textResult('{"success":false}'),
      structuredContent: { success: true },
    }));
    await withSdk(
      (server) => {
        installMcpToolDescriptorDefaults(server);
        server.registerTool(
          "workspace_todo_list",
          { outputSchema: z.object({ success: z.boolean() }) },
          callback,
        );
      },
      async (post) => {
        const { consumed } = await post(call(1, "workspace_todo_list"));
        const body = await consumed;
        expect(callback).toHaveBeenCalledOnce();
        expect(body.messages).toEqual([
          {
            jsonrpc: "2.0",
            id: 1,
            result: {
              ...responseMetadata,
              isError: true,
              content: [
                {
                  type: "text",
                  text: "MCP tool result text and structured content must agree",
                },
              ],
            },
          },
        ]);
        expect(body.usageAtEof).toEqual([{ ...readSuccess, outcome: "error" }]);
      },
    );
  });

  it("counts the SDK's own output-schema rejection after a successful callback", async () => {
    const callback = vi.fn(async () => ({
      ...textResult("invalid structured result"),
      structuredContent: { success: "wrong type" },
    }));
    await withSdk(
      (server) => {
        server.registerTool(
          "workspace_todo_list",
          { outputSchema: { success: z.boolean() } },
          callback,
        );
      },
      async (post) => {
        const { consumed } = await post(call(1, "workspace_todo_list"));
        const body = await consumed;
        expect(callback).toHaveBeenCalledOnce();
        expect(body.messages).toEqual([
          {
            jsonrpc: "2.0",
            id: 1,
            result: {
              ...responseMetadata,
              isError: true,
              content: [
                {
                  type: "text",
                  text: expect.stringContaining("Output validation error"),
                },
              ],
            },
          },
        ]);
        expect(body.usageAtEof).toEqual([{ ...readSuccess, outcome: "error" }]);
      },
    );
  });

  it("counts a real SDK JSON-RPC error envelope", async () => {
    const callback = vi.fn(async () => {
      throw new ProtocolError(-32603, "fixture protocol failure");
    });
    await withSdk(
      (server) => {
        server.registerTool("workspace_todo_list", {}, callback);
        server.server.setRequestHandler("tools/call", callback);
      },
      async (post) => {
        const { consumed } = await post(
          call("approval", "workspace_todo_list"),
        );
        const body = await consumed;
        expect(callback).toHaveBeenCalledOnce();
        expect(body.messages).toEqual([
          {
            jsonrpc: "2.0",
            id: "approval",
            error: {
              code: -32603,
              message: expect.stringContaining("fixture protocol failure"),
            },
          },
        ]);
        expect(body.usageAtEof).toEqual([{ ...readSuccess, outcome: "error" }]);
      },
    );
  });

  it("records a delayed request only after the SDK delivers its result", async () => {
    const entered = createDeferred();
    const release = createDeferred();
    await withSdk(
      (server) => {
        server.registerTool("workspace_todo_list", {}, async () => {
          entered.resolve();
          await release.promise;
          return textResult("late success");
        });
      },
      async (post) => {
        const pending = post(call("delayed", "workspace_todo_list"));
        try {
          await Promise.race([
            entered.promise,
            pending.then(({ response }) => {
              throw new Error(`Unexpected early HTTP ${response.status}`);
            }),
          ]);
          expect(usage()).toEqual([]);
          release.resolve();
          const body = await (await pending).consumed;
          expect(body.messages).toEqual([
            {
              jsonrpc: "2.0",
              id: "delayed",
              result: {
                ...responseMetadata,
                content: [{ type: "text", text: "late success" }],
              },
            },
          ]);
          expect(body.usageAtEof).toEqual([readSuccess]);
          expect(usage()).toEqual([readSuccess]);
        } finally {
          release.resolve();
          await pending;
        }
      },
    );
  });

  it("rejects batch requests before any tool callback", async () => {
    const callback = vi.fn(async () => textResult("unreachable"));
    await withSdk(
      (server) => {
        server.registerTool("workspace_todo_create", {}, callback);
      },
      async (post) => {
        const { response, consumed } = await post([
          call(1, "workspace_todo_create"),
          call(2, "workspace_todo_create"),
        ]);
        expect(response.status).toBe(400);
        expect((await consumed).messages[0].error).toBeDefined();
        expect(callback).not.toHaveBeenCalled();
        expect(usage()).toEqual([]);
        expect(authenticateMock).not.toHaveBeenCalled();
        expect(rateLimitMock).not.toHaveBeenCalled();
      },
    );
  });

  it("rejects duplicate request IDs before authorization or tool execution", async () => {
    const write = vi.fn(async () => textResult("must not write"));
    const read = vi.fn(async () => textResult("must not read"));
    await withSdk(
      (server) => {
        server.registerTool("workspace_todo_create", {}, write);
        server.registerTool("workspace_todo_list", {}, read);
      },
      async (post) => {
        const { response, consumed } = await post([
          call(1, "workspace_todo_create"),
          call(1, "workspace_todo_list"),
        ]);
        expect(response.status).toBe(400);
        expect(response.headers.get("content-type")).toContain(
          "application/json",
        );
        const body = await consumed;
        expect(body.messages).toEqual([
          {
            jsonrpc: "2.0",
            id: null,
            error: { code: -32600, message: "Invalid Request" },
          },
        ]);
        expect(authenticateMock).not.toHaveBeenCalled();
        expect(rateLimitMock).not.toHaveBeenCalled();
        expect(createServerMock).not.toHaveBeenCalled();
        expect(write).not.toHaveBeenCalled();
        expect(read).not.toHaveBeenCalled();
        expect(body.usageAtEof).toEqual([]);
        expect(usage()).toEqual([]);
      },
    );
  });

  it.each([
    { jsonrpc: "2.0", method: "notifications/initialized" },
    {
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "workspace_todo_list", arguments: {} },
    },
  ])("does not account for a notification: $method", async (notification) => {
    const callback = vi.fn(async () => textResult("not a request"));
    await withSdk(
      (server) => {
        server.registerTool("workspace_todo_list", {}, callback);
      },
      async (post) => {
        const { response, consumed } = await post(notification);
        expect(response.status).toBe(202);
        expect(await consumed).toEqual({
          text: "",
          messages: [],
          usageAtEof: [],
        });
        expect(callback).not.toHaveBeenCalled();
        expect(usage()).toEqual([]);
      },
    );
  });

  it("does not account for discovery or tools listing", async () => {
    await withSdk(
      (server) => {
        server.registerTool("workspace_todo_list", {}, async () =>
          textResult("unused"),
        );
      },
      async (post) => {
        const initialized = await post({
          jsonrpc: "2.0",
          id: "init",
          method: "server/discover",
          params: {},
        });
        expect(initialized.response.status).toBe(200);
        const handshake = await initialized.consumed;
        expect(handshake.messages).toHaveLength(1);
        expect(handshake.messages[0]).toMatchObject({
          id: "init",
          result: { supportedVersions: ["2026-07-28"] },
        });
        expect(handshake.usageAtEof).toEqual([]);
        const listed = await post({
          jsonrpc: "2.0",
          id: "list",
          method: "tools/list",
        });
        const listing = await listed.consumed;
        expect(listing.messages).toHaveLength(1);
        expect(listing.messages[0].result?.tools).toEqual([
          expect.objectContaining({ name: "workspace_todo_list" }),
        ]);
        expect(usage()).toEqual([]);
      },
    );
  });

  it("excludes the GraphQL bridge and public tools while keeping a native sibling", async () => {
    const bridge = vi.fn(async () => textResult("bridge result"));
    await withSdk(
      (server) => {
        server.registerTool("graphql_operation_run", {}, bridge);
        server.registerTool("catalog_course_search", {}, async () =>
          textResult("public result"),
        );
        server.registerTool("workspace_todo_list", {}, async () =>
          textResult("native result"),
        );
      },
      async (post) => {
        const bodies = [];
        for (const request of [
          call(1, "graphql_operation_run"),
          call(2, "catalog_course_search"),
          call(3, "workspace_todo_list"),
        ])
          bodies.push(await (await post(request)).consumed);
        const body = {
          messages: bodies.flatMap((value) => value.messages),
          usageAtEof: bodies.at(-1)?.usageAtEof,
        };
        expect(bridge).toHaveBeenCalledOnce();
        expect(body.messages).toHaveLength(3);
        expect(
          body.messages.every(
            (message) => !message.error && !message.result?.isError,
          ),
        ).toBe(true);
        // Selected GraphQL fields own their usage elsewhere; this envelope adds none.
        expect(body.usageAtEof).toEqual([readSuccess]);
        expect(usage()).toEqual([readSuccess]);
      },
    );
  });
});
