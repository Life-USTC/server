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
 *   try {
 *     const result = await callTool("get_my_profile");
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
import { createMcpServer } from "@/lib/mcp/server";
import {
  DEFAULT_OAUTH_CLIENT_SCOPES,
  REST_FEATURES,
  restReadScope,
  restWriteScope,
} from "@/lib/oauth/constants";

const MCP_TEST_FEATURES = REST_FEATURES.filter(
  (feature) => feature !== "admin",
);
const MCP_TEST_SCOPES = MCP_TEST_FEATURES.flatMap((feature) => [
  restReadScope(feature),
  restWriteScope(feature),
]);

/**
 * Build a minimal AuthInfo that makes tool handlers believe
 * `getUserId(extra.authInfo)` returns `userId`.
 */
export function makeTestAuthInfo(userId: string): AuthInfo {
  return {
    token: "integration-test-token",
    clientId: "integration-test-client",
    scopes: [...DEFAULT_OAUTH_CLIENT_SCOPES, ...MCP_TEST_SCOPES],
    extra: { userId },
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
export async function createMcpHarness(userId: string): Promise<McpHarness> {
  const authInfo = makeTestAuthInfo(userId);
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const authenticatedClientTransport = new AuthenticatedInMemoryTransport(
    clientTransport,
    authInfo,
  );

  const mcpServer = createMcpServer();
  const client = new Client({
    name: "integration-test-harness",
    version: "1.0.0",
  });

  await mcpServer.connect(serverTransport);
  await client.connect(authenticatedClientTransport);

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

  function parseResult(
    result: Awaited<ReturnType<typeof client.callTool>>,
  ): unknown {
    const content = Array.isArray(result.content) ? result.content : [];
    const textItem = content.find(isTextContentItem);
    if (!textItem) {
      throw new Error("MCP tool returned no text content");
    }
    return JSON.parse(textItem.text);
  }

  async function callTool(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<unknown> {
    const result = await client.callTool({ name, arguments: args });
    return parseResult(result);
  }

  async function call<T = Record<string, unknown>>(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<T> {
    return callTool(name, args) as Promise<T>;
  }

  async function close(): Promise<void> {
    await client.close();
  }

  return { callTool, call, close };
}
