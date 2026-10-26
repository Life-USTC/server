import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { createWaitUntil } from "./wait-until";

/**
 * Own Node callbacks and their waitUntil work under the supplied bindings.
 * `run` tracks only its callback: include response consumption and observations
 * in an outer workflow when they outlive a request. `close` rejects new work,
 * joins admitted callbacks, and cancels unread returned bodies before draining
 * cleanup. Call it outside the callbacks it owns to avoid waiting on itself.
 */
export function createNodeRuntime(env: unknown) {
  const responses = new Set<Response>();
  const operations: Promise<void>[] = [];
  const collectors: ReturnType<typeof createWaitUntil>[] = [];
  let closing: Promise<void> | undefined;
  function run<T>(work: () => T | Promise<T>): Promise<T> {
    if (closing) return Promise.reject(new Error("Node runtime is closing"));
    const pending = createWaitUntil();
    collectors.push(pending);
    const operation = (async () => {
      const [result] = await Promise.allSettled([
        runWithCloudflareRuntimeEnv(env, work, pending),
      ]);
      // Only the returned body owns runtime cleanup; its original is locked
      // by the runtime wrapper and must never be cancelled separately.
      if (result.status === "fulfilled" && result.value instanceof Response)
        responses.add(result.value);
      const [background] = await Promise.allSettled([pending.drain()]);
      if (result.status === "rejected") {
        if (background.status === "rejected")
          throw new AggregateError(
            [result.reason, background.reason],
            "Node request and background work failed",
          );
        throw result.reason;
      }
      if (background.status === "rejected") throw background.reason;
      return result.value;
    })();
    // Return the rejecting operation to its caller; teardown waits without
    // reporting an expected business rejection a second time.
    operations.push(
      operation.then(
        () => undefined,
        () => undefined,
      ),
    );
    return operation;
  }
  function close(): Promise<void> {
    closing ??= (async () => {
      await Promise.all(operations);
      const settled = await Promise.allSettled(
        [...responses].map((response) =>
          response.body && !response.bodyUsed
            ? response.body.cancel()
            : undefined,
        ),
      );
      responses.clear();
      // EOF/cancel can schedule additional waitUntil work and final client
      // cleanup. Observe it even when another response's cancellation failed.
      settled.push(
        ...(await Promise.allSettled(
          collectors.map((pending) => pending.drain()),
        )),
      );
      const failures = settled.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (failures.length)
        throw new AggregateError(failures, "Node runtime cleanup failed");
    })();
    return closing;
  }
  return { run, close };
}
