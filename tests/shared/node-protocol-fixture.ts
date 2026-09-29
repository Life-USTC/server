import { setCloudflareCatalogInvalidator } from "@/lib/adapters/cloudflare-runtime";
import { isolatedDatabaseTest } from "./isolated-database";
import { createNodeRuntime } from "./node-runtime";

type NodeRuntime = ReturnType<typeof createNodeRuntime>;
export type NodeProtocolRuntime = {
  run: NodeRuntime["run"];
  request: NodeRuntime["run"];
  drain: NodeRuntime["close"];
  close: NodeRuntime["close"];
};

// Outer workflows and nested requests have distinct lifetimes: a timed-out
// workflow can finish its already-admitted work before requests stop accepting IO.
export const nodeProtocolTest = isolatedDatabaseTest.extend<{
  protocolBindings: Record<string, unknown>;
  protocolRuntime: NodeProtocolRuntime;
}>({
  protocolBindings: {},
  protocolRuntime: async ({ isolatedDatabase, protocolBindings }, use) => {
    const { connections } = isolatedDatabase;
    const env = {
      APP_PUBLIC_ORIGIN: "http://localhost:3000",
      USER_WRITE_RATE_LIMITER: { limit: async () => ({ success: true }) },
      USER_BATCH_WRITE_RATE_LIMITER: { limit: async () => ({ success: true }) },
      CALENDAR_EXPORT_REBUILD: { send: async () => {} },
      ...protocolBindings,
      HYPERDRIVE: { connectionString: connections.app },
      HYPERDRIVE_AUTH: { connectionString: connections.auth },
      HYPERDRIVE_MAINTENANCE: { connectionString: connections.maintenance },
    };
    const lifetime = createNodeRuntime(env);
    const requests = createNodeRuntime(env);
    function scoped(runtime: NodeRuntime): NodeRuntime["run"] {
      return (work) =>
        runtime.run(() => {
          // These Node contracts have no Worker HTML cache; Worker tests cover
          // delivery and invalidation. Both bindings remain local to this request.
          setCloudflareCatalogInvalidator(async () => {});
          return work();
        });
    }
    let closing: Promise<void> | undefined;
    function close() {
      closing ??= (async () => {
        const results = await Promise.allSettled([lifetime.close()]);
        results.push(...(await Promise.allSettled([requests.close()])));
        const failures = results.flatMap((result) =>
          result.status === "rejected" ? [result.reason] : [],
        );
        if (failures.length)
          throw new AggregateError(failures, "Node protocol cleanup failed");
      })();
      return closing;
    }
    try {
      await use({
        run: scoped(lifetime),
        request: scoped(requests),
        drain: lifetime.close,
        close,
      });
    } finally {
      await close();
    }
  },
});
