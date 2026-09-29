import { isolatedDatabaseTest } from "./isolated-database";
import { createNodeRuntime } from "./node-runtime";

type ProviderRuntime = {
  run: ReturnType<typeof createNodeRuntime>["run"];
  request: ReturnType<typeof createNodeRuntime>["run"];
  close: () => Promise<void>;
};

// Each installed-provider consumer owns an isolated Vitest file/process because
// Better Auth and its resource policy cache retain process-level state.
export const oauthProviderTest = isolatedDatabaseTest.extend<{
  oauthEnvironment: Record<string, string>;
  oauthRuntime: ProviderRuntime;
}>({
  oauthEnvironment: {},
  oauthRuntime: async ({ isolatedDatabase, oauthEnvironment }, use) => {
    const { connections } = isolatedDatabase;
    const env = {
      APP_PUBLIC_ORIGIN: "http://localhost:3000",
      ...oauthEnvironment,
      HYPERDRIVE: { connectionString: connections.app },
      HYPERDRIVE_AUTH: { connectionString: connections.auth },
    };
    const lifetime = createNodeRuntime(env);
    const requests = createNodeRuntime(env);
    let closing: Promise<void> | undefined;
    function close() {
      closing ??= (async () => {
        const results = await Promise.allSettled([lifetime.close()]);
        results.push(...(await Promise.allSettled([requests.close()])));
        const failures = results.flatMap((result) =>
          result.status === "rejected" ? [result.reason] : [],
        );
        if (failures.length)
          throw new AggregateError(failures, "OAuth provider cleanup failed");
      })();
      return closing;
    }
    try {
      await use({ run: lifetime.run, request: requests.run, close });
    } finally {
      await close();
    }
  },
});
