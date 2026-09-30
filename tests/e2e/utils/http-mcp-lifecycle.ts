import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { expect } from "@playwright/test";

export type HttpMcpRequest = {
  requestId: string;
  method: string;
  path: string;
  rpc?: string;
  tool?: string;
  status: number;
};

/** Own finite native MCP responses; the caller owns the body and server drain. */
export function ownHttpMcp({
  origin,
  headers,
  remember,
}: {
  origin: string;
  headers: Record<string, string>;
  remember: (error: unknown) => void;
}) {
  const pending = new Set<Promise<void>>();
  const requests: HttpMcpRequest[] = [];
  const clients: (() => Promise<void>)[] = [];
  const abort = new AbortController();
  let closed = false;
  let closing: Promise<void> | undefined;
  const settle = async () => {
    while (pending.size) await Promise.all([...pending]);
  };
  const sdkFetch: typeof fetch = (input, init) => {
    const operation = Promise.resolve().then(async () => {
      if (closed) throw new Error("HTTP MCP transport is closed");
      const incoming = new Request(input, init);
      const url = new URL(incoming.url);
      expect(url.origin).toBe(origin);
      expect(url.pathname).toBe("/api/mcp");
      const payload =
        incoming.method === "POST"
          ? ((await incoming.clone().json()) as {
              method: string;
              params?: { name?: string };
            })
          : undefined;
      expect(
        incoming.method === "GET" ||
          (incoming.method === "POST" &&
            ["initialize", "notifications/initialized", "tools/call"].includes(
              payload?.method ?? "",
            )),
      ).toBe(true);
      const expectedStatus =
        incoming.method === "GET"
          ? 405
          : payload?.method === "notifications/initialized"
            ? 202
            : 200;
      const requestId = crypto.randomUUID();
      requests.push({
        requestId,
        method: incoming.method,
        path: url.pathname,
        rpc: payload?.method,
        tool: payload?.params?.name,
        status: expectedStatus,
      });
      const tagged = new Headers(incoming.headers);
      for (const [name, value] of Object.entries(headers))
        tagged.set(name, value);
      tagged.set("x-test-community-request", requestId);
      const response = await fetch(
        new Request(incoming, {
          headers: tagged,
          signal: AbortSignal.any([incoming.signal, abort.signal]),
        }),
      );
      // Read the actual response through EOF before the SDK parses its bytes.
      const body = response.body ? await response.arrayBuffer() : null;
      expect(response.status).toBe(expectedStatus);
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    });
    // Report errors even if a late SDK callback arrives after close returned.
    const settled = operation.then(() => undefined, remember);
    pending.add(settled);
    void settled.finally(() => pending.delete(settled));
    return operation;
  };
  return {
    requests,
    settle,
    async connect(
      identity: { name: string; version: string },
      accessToken: string,
    ) {
      if (closing) throw new Error("HTTP MCP workflow is closing");
      const client = new Client(identity);
      const transport = new StreamableHTTPClientTransport(
        new URL("/api/mcp", origin),
        {
          requestInit: {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
          fetch: sdkFetch,
        },
      );
      let disposed: Promise<void> | undefined;
      // Register before connect can start its handshake or stream.
      clients.push(() => (disposed ??= client.close()));
      await client.connect(transport);
      return client;
    },
    close(completed: boolean) {
      closing ??= (async () => {
        // Interruption closes first so a pending call can release the body.
        if (completed) {
          try {
            await expect.poll(() => pending.size, { timeout: 15_000 }).toBe(0);
          } catch (error) {
            remember(error);
          }
        }
        for (const close of clients) {
          try {
            await close();
          } catch (error) {
            remember(error);
          }
        }
        closed = true;
        abort.abort(new Error("HTTP MCP transport disposed"));
        await settle();
      })();
      return closing;
    },
  };
}
