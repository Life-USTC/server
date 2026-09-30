import { isolatedDatabaseTest } from "./isolated-database";
import { createNodeRuntime } from "./node-runtime";

/** Direct domain requests own their connections and deferred work before setup. */
export const isolatedNodeTest = isolatedDatabaseTest.extend<{
  nodeRuntime: ReturnType<typeof createNodeRuntime>;
}>({
  nodeRuntime: async ({ isolatedDatabase, onTestFinished }, use) => {
    const runtime = createNodeRuntime({
      APP_PUBLIC_ORIGIN: "http://localhost:3000",
      HYPERDRIVE: { connectionString: isolatedDatabase.connections.app },
      HYPERDRIVE_AUTH: { connectionString: isolatedDatabase.connections.auth },
      HYPERDRIVE_MAINTENANCE: {
        connectionString: isolatedDatabase.connections.maintenance,
      },
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
