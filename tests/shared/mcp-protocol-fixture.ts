import {
  ownAnonymousMcpHarness,
  ownMcpHarness,
} from "../integration/mcp/_harness/client";
import { nodeHttpTest } from "./node-http-contract-fixture";
import type { NodeProtocolRuntime } from "./node-protocol-runtime";

/** Track each real route response, including bodies an assertion does not read. */
export function ownProtocolRoute<Args extends unknown[], Result>(
  runtime: NodeProtocolRuntime,
  handler: (...args: Args) => Promise<Result>,
) {
  return (...args: Args) => runtime.request(() => handler(...args));
}

// The HTTP listener is lazy: only fixtures that request http start it.
export const mcpProtocolTest = nodeHttpTest.extend(
  "mcpSessions",
  async ({ protocolRuntime }, { onCleanup }) => {
    const clients: { close(): Promise<void> }[] = [];
    let closed = false;
    function ownClient<T extends { close(): Promise<void> }>(client: T): T {
      if (closed) throw new Error("MCP protocol sessions are closed");
      clients.push(client);
      return client;
    }
    onCleanup(async () => {
      closed = true;
      // Abort pending SDK initialization/calls and await native handlers first.
      const results = await Promise.allSettled(
        clients.map((client) => client.close()),
      );
      results.push(...(await Promise.allSettled([protocolRuntime.drain()])));
      const failures = results.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (failures.length)
        throw new AggregateError(failures, "MCP protocol cleanup failed");
    });
    async function createMcpHarness(
      userId: string,
      scopes?: readonly string[],
    ) {
      if (closed) throw new Error("MCP protocol sessions are closed");
      const owned = ownMcpHarness(userId, scopes, {
        run: protocolRuntime.request,
      });
      ownClient(owned.client);
      await protocolRuntime.request(() => owned.initialize());
      return owned.client;
    }
    async function createAnonymousMcpHarness() {
      if (closed) throw new Error("MCP protocol sessions are closed");
      const owned = ownAnonymousMcpHarness({ run: protocolRuntime.request });
      ownClient(owned.client);
      await protocolRuntime.request(() => owned.initialize());
      return owned.client;
    }
    return { createMcpHarness, createAnonymousMcpHarness, ownClient };
  },
);
