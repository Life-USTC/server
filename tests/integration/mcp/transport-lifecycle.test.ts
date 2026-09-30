import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { expect, test, vi } from "vitest";
import { createNodeRuntime } from "../../shared/node-runtime";
import { ownAnonymousMcpHarness, ownMcpHarness } from "./_harness/client";

// One scenario owns these prototype spies in its Vitest-isolated module.
test("MCP transports stay closed when initialization resumes after disposal", async ({
  signal,
  onTestFinished,
}) => {
  const workflow = createNodeRuntime({});
  const cleanups = new Set<() => Promise<void>>();
  onTestFinished(async () => {
    const results = await Promise.allSettled(
      [...cleanups].map((close) => close()),
    );
    results.push(...(await Promise.allSettled([workflow.close()])));
    const errors = results.flatMap((r) =>
      r.status === "rejected" ? [r.reason] : [],
    );
    if (errors.length)
      throw new AggregateError(errors, "Transport lifecycle cleanup failed");
  });
  await workflow.run(async () => {
    for (const own of [
      () => ownMcpHarness("transport-lifecycle-owner"),
      ownAnonymousMcpHarness,
    ]) {
      for (const stage of [1, 2]) {
        signal.throwIfAborted();
        let release!: () => void;
        let entered!: () => void;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        const started = new Promise<void>((resolve) => {
          entered = resolve;
        });
        let starts = 0;
        let pair:
          | ReturnType<typeof InMemoryTransport.createLinkedPair>
          | undefined;
        const originalPair = InMemoryTransport.createLinkedPair;
        const pairSpy = vi
          .spyOn(InMemoryTransport, "createLinkedPair")
          .mockImplementation(() => {
            pair = originalPair();
            return pair;
          });
        const originalStart = InMemoryTransport.prototype.start;
        const startSpy = vi
          .spyOn(InMemoryTransport.prototype, "start")
          .mockImplementation(async function (this: InMemoryTransport) {
            const current = ++starts;
            // Use the actual transport, then delay its connect() continuation.
            // Stage 1 is the server; stage 2 is the client's initialization.
            await originalStart.call(this);
            if (current === stage) {
              entered();
              await gate;
            }
          });
        let owned: ReturnType<typeof ownMcpHarness> | undefined;
        let initializing: Promise<void> | undefined;
        let cleaning: Promise<void> | undefined;
        function cleanup() {
          cleaning ??= (async () => {
            entered();
            release();
            try {
              await owned?.client.close();
              await initializing?.catch(() => undefined);
            } finally {
              startSpy.mockRestore();
              pairSpy.mockRestore();
            }
          })();
          return cleaning;
        }
        cleanups.add(cleanup);
        try {
          owned = own();
          initializing = owned.initialize();
          void initializing.catch(() => undefined);
          await Promise.race([started, initializing]);
          signal.throwIfAborted();
          expect(starts).toBe(stage);
          await owned.client.close();
          release();
          await expect(initializing).rejects.toThrow();
          if (!pair) throw new Error("Expected the real transport pair");
          for (const transport of pair) {
            await expect(
              transport.send({ jsonrpc: "2.0", method: "ping" }),
            ).rejects.toThrow("Not connected");
          }
          await expect(owned.client.listTools()).rejects.toThrow();
        } finally {
          try {
            await cleanup();
          } finally {
            cleanups.delete(cleanup);
          }
        }
      }
    }
  });
});
