/**
 * MCP in-process harness.
 *
 * Shared seed/setup workflow lives in the repo root `AGENTS.md`; this helper only
 * encapsulates the authenticated in-process client/server wiring used by
 * integration tests.
 *
 * Creates a real McpServer connected to a real MCP Client via InMemoryTransport,
 * with a synthetic AuthInfo injected so tool handlers see an authenticated user.
 * No HTTP, no browser — just direct function call overhead.
 *
 * Usage:
 *   const { callTool, close } = await createMcpHarness(userId);
 *   const anonymous = await createAnonymousMcpHarness();
 *   try {
 *     const result = await callTool("account_profile_get");
 *     // result is the parsed JSON payload the tool returned
 *   } finally {
 *     await close();
 *   }
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type {
  Transport,
  TransportSendOptions,
} from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import {
  createMcpServerInstance,
  registerMcpServerCapabilities,
} from "@/lib/mcp/server";
import { DEFAULT_OAUTH_CLIENT_SCOPES } from "@/lib/oauth/constants";
import { PUBLIC_REST_SCOPES } from "@/lib/oauth/scope-registry";

const MCP_TEST_SCOPES = PUBLIC_REST_SCOPES;

type RequestRuntime = {
  run<T>(work: () => T | Promise<T>): Promise<T>;
};

/**
 * Build a minimal AuthInfo that makes tool handlers believe
 * `getUserId(extra.authInfo)` returns `userId`.
 */
export function makeTestAuthInfo(
  userId: string,
  featureScopes: readonly string[] = MCP_TEST_SCOPES,
): AuthInfo {
  return {
    token: "integration-test-token",
    clientId: "integration-test-client",
    scopes: [...DEFAULT_OAUTH_CLIENT_SCOPES, ...featureScopes],
    extra: { userId, grantId: "integration-test-grant" },
  };
}

export type McpHarness = {
  /** Call a tool by name with the given arguments, return the parsed JSON payload. */
  callTool(name: string, args?: Record<string, unknown>): Promise<unknown>;
  /** Typed convenience that calls callTool and casts the result. */
  call<T = Record<string, unknown>>(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<T>;
  /** Call a tool and retain protocol metadata such as auth challenges. */
  callToolResult(
    name: string,
    args?: Record<string, unknown>,
  ): ReturnType<Client["callTool"]>;
  getInstructions(): string | undefined;
  getPrompt(
    name: string,
    args?: Record<string, string>,
  ): ReturnType<Client["getPrompt"]>;
  listPrompts(): ReturnType<Client["listPrompts"]>;
  listResources(): ReturnType<Client["listResources"]>;
  readResource(uri: string): ReturnType<Client["readResource"]>;
  listTools(): ReturnType<Client["listTools"]>;
  /** Close the in-process MCP session. */
  close(): Promise<void>;
};

class AuthenticatedInMemoryTransport implements Transport {
  constructor(
    private readonly transport: InMemoryTransport,
    private readonly authInfo: AuthInfo,
  ) {}

  get onclose() {
    return this.transport.onclose;
  }

  set onclose(callback) {
    this.transport.onclose = callback;
  }

  get onerror() {
    return this.transport.onerror;
  }

  set onerror(callback) {
    this.transport.onerror = callback;
  }

  get onmessage() {
    return this.transport.onmessage;
  }

  set onmessage(callback) {
    this.transport.onmessage = callback;
  }

  get sessionId() {
    return this.transport.sessionId;
  }

  set sessionId(value) {
    this.transport.sessionId = value;
  }

  start() {
    return this.transport.start();
  }

  send(message: JSONRPCMessage, options?: TransportSendOptions) {
    return this.transport.send(message, {
      ...options,
      authInfo: this.authInfo,
    });
  }

  close() {
    return this.transport.close();
  }
}

/**
 * Spin up an in-process MCP client + server pair authenticated as `userId`.
 *
 * The trick: `InMemoryTransport.createLinkedPair()` links two transports A and B
 * so that `A.send(msg, { authInfo })` calls `B.onmessage(msg, { authInfo })`.
 * The client receives a wrapper transport that adds the test AuthInfo to every
 * outbound message, so every MCP request the server receives is authenticated.
 */
export async function createMcpHarness(
  userId: string,
  featureScopes: readonly string[] = MCP_TEST_SCOPES,
): Promise<McpHarness> {
  return initializeMcpHarness(ownMcpHarness(userId, featureScopes));
}

async function initializeMcpHarness(owned: ReturnType<typeof ownMcpHarness>) {
  try {
    await owned.initialize();
    return owned.client;
  } catch (error) {
    try {
      await owned.client.close();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "MCP initialization and cleanup failed",
      );
    }
    throw error;
  }
}

/** Register client.close with the fixture before awaiting initialize. */
export function ownMcpHarness(
  userId: string,
  featureScopes: readonly string[] = MCP_TEST_SCOPES,
  runtime?: RequestRuntime,
) {
  const authInfo = makeTestAuthInfo(userId, featureScopes);
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const authenticatedClientTransport = new AuthenticatedInMemoryTransport(
    clientTransport,
    authInfo,
  );

  return ownMcpTransport(
    authenticatedClientTransport,
    serverTransport,
    "integration-test-harness",
    runtime,
  );
}

function ownMcpTransport(
  clientTransport: Transport,
  serverTransport: Transport,
  name: string,
  runtime?: RequestRuntime,
) {
  const mcpServer = createMcpServerInstance();
  const operations = new Set<Promise<void>>();
  let closed = false;
  let closing: Promise<void> | undefined;
  // SDK transport.close aborts requests but does not await their handlers.
  // Observe the real server callback, including runtime waitUntil work, before
  // registration. Client rejection alone does not mean DB work has stopped.
  const register = mcpServer.server.setRequestHandler.bind(mcpServer.server);
  mcpServer.server.setRequestHandler = (schema, handler) => {
    register(schema, (request, extra) => {
      if (closed) throw new Error("MCP fixture is closed");
      const work = () => handler(request, extra);
      const operation = Promise.resolve().then(() =>
        runtime ? runtime.run(work) : work(),
      );
      const settled = operation.then(
        () => undefined,
        () => undefined,
      );
      operations.add(settled);
      void settled.then(() => operations.delete(settled));
      return operation;
    });
  };
  registerMcpServerCapabilities(mcpServer);
  const client = new Client({ name, version: "1.0.0" });
  const harness = createMcpHarnessClient(client, () => mcpServer.close());
  function requireOpen() {
    if (closed) throw new Error("MCP fixture was closed during initialization");
  }
  return {
    server: mcpServer,
    client: {
      ...harness,
      close: () => {
        closing ??= (async () => {
          closed = true;
          const [transport] = await Promise.allSettled([harness.close()]);
          await Promise.all(operations);
          if (transport.status === "rejected") throw transport.reason;
        })();
        return closing;
      },
    },
    initialize: async () => {
      requireOpen();
      await mcpServer.connect(serverTransport);
      requireOpen();
      await client.connect(clientTransport);
      requireOpen();
    },
  };
}

function isTextContentItem(
  value: unknown,
): value is { type: "text"; text: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "text" &&
    "text" in value &&
    typeof value.text === "string"
  );
}

function parseToolResult(
  result: Awaited<ReturnType<Client["callTool"]>>,
): unknown {
  const content = Array.isArray(result.content) ? result.content : [];
  const textItem = content.find(isTextContentItem);
  if (!textItem) {
    throw new Error("MCP tool returned no text content");
  }
  if (result.isError) {
    throw new Error(`MCP tool failed: ${textItem.text}`);
  }
  return JSON.parse(textItem.text);
}

function createMcpHarnessClient(
  client: Client,
  closeServer: () => Promise<void>,
): McpHarness {
  async function callTool(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<unknown> {
    const result = await client.callTool({ name, arguments: args });
    return parseToolResult(result);
  }

  function callToolResult(name: string, args: Record<string, unknown> = {}) {
    return client.callTool({ name, arguments: args });
  }

  async function call<T = Record<string, unknown>>(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<T> {
    return callTool(name, args) as Promise<T>;
  }

  async function close(): Promise<void> {
    const results = await Promise.allSettled([client.close(), closeServer()]);
    const errors = results.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    );
    if (errors.length)
      throw new AggregateError(errors, "MCP transport cleanup failed");
  }

  return {
    callTool,
    callToolResult,
    call,
    getInstructions: () => client.getInstructions(),
    getPrompt: (name, args = {}) => client.getPrompt({ name, arguments: args }),
    listPrompts: () => client.listPrompts(),
    listResources: () => client.listResources(),
    readResource: (uri) => client.readResource({ uri }),
    listTools: () => client.listTools(),
    close,
  };
}

/**
 * Spin up an in-process MCP client + server pair with no authentication.
 * Tool handlers that require a user context should reject these calls.
 */
export async function createAnonymousMcpHarness(): Promise<McpHarness> {
  return initializeMcpHarness(ownAnonymousMcpHarness());
}

/** Anonymous transports have the same native fixture ownership lifecycle. */
export function ownAnonymousMcpHarness(runtime?: RequestRuntime) {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  return ownMcpTransport(
    clientTransport,
    serverTransport,
    "integration-test-anonymous",
    runtime,
  );
}
