import type { TestContext } from "vitest";
import type { McpHarness } from "../integration/mcp/_harness/client";
import type { NodeProtocolRuntime } from "./node-protocol-runtime";

/** Close SDKs before joining their borrowed protocol workflow owner. */
export async function withMcpSdkLifecycle(
  {
    protocolRuntime,
    onTestFinished,
  }: {
    protocolRuntime: Pick<NodeProtocolRuntime, "drain">;
    onTestFinished: TestContext["onTestFinished"];
  },
  sessions: readonly { client: McpHarness }[],
  failureMessage: string,
  use: () => Promise<void>,
) {
  const failures: unknown[] = [];
  try {
    await use();
  } catch (error) {
    failures.push(error);
  } finally {
    // Closing SDKs rejects pending initialization/client calls and also waits
    // for real server handlers and their background work.
    const results = await Promise.allSettled(
      sessions.map(({ client }) => client.close()),
    );
    // The runtime owner reports its original cached rejection once.
    // Keep waiting here so no admitted workflow outlives this boundary.
    await Promise.allSettled([protocolRuntime.drain()]);
    failures.push(
      ...results.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      ),
    );
  }
  if (failures.length) {
    const error =
      failures.length === 1
        ? failures[0]
        : new AggregateError(failures, failureMessage);
    onTestFinished(() => {
      throw error;
    });
  }
}
