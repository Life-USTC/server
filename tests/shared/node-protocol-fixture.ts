import { isolatedDatabaseTest } from "./isolated-database";
import {
  createNodeProtocolRuntime,
  type NodeProtocolRuntime,
} from "./node-protocol-runtime";

// Outer workflows and nested requests have distinct lifetimes: a timed-out
// workflow can finish its already-admitted work before requests stop accepting IO.
export const nodeProtocolTest = isolatedDatabaseTest.extend<{
  protocolBindings: Record<string, unknown>;
  protocolRuntime: NodeProtocolRuntime;
}>({
  protocolBindings: {},
  protocolRuntime: async (
    { isolatedDatabase, protocolBindings, onTestFinished },
    use,
  ) => {
    const { connections } = isolatedDatabase;
    const runtime = createNodeProtocolRuntime({
      APP_PUBLIC_ORIGIN: "http://localhost:3000",
      USER_WRITE_RATE_LIMITER: { limit: async () => ({ success: true }) },
      USER_BATCH_WRITE_RATE_LIMITER: { limit: async () => ({ success: true }) },
      CALENDAR_EXPORT_REBUILD: { send: async () => {} },
      ...protocolBindings,
      HYPERDRIVE: { connectionString: connections.app },
      HYPERDRIVE_AUTH: { connectionString: connections.auth },
      HYPERDRIVE_MAINTENANCE: { connectionString: connections.maintenance },
    });
    try {
      await use(runtime);
    } finally {
      try {
        await runtime.close();
      } catch (error) {
        // Release outer database owners before reporting this original error.
        onTestFinished(() => {
          throw error;
        });
      }
    }
  },
});
