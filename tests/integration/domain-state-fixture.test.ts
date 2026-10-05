import { expect } from "vitest";
import { getCloudflareRuntimeTaskScheduler } from "@/lib/adapters/cloudflare-runtime";
import { domainStateTest } from "../shared/domain-state-fixture";
import { ownIsolatedDatabase } from "../shared/isolated-database-lifecycle";
import { createNodeRuntime } from "../shared/node-runtime";
import { createFixturePrisma } from "../shared/prisma";

type CleanupProbe = {
  response?: Response;
  cancellations: number;
  users: string[];
  database?: string;
};

const it = domainStateTest.extend<{
  cleanupProbe: CleanupProbe;
  probeRun: ReturnType<typeof createNodeRuntime>["run"];
  _databaseResources: ReturnType<typeof ownIsolatedDatabase>;
}>({
  probeRun: async ({ state, onTestFinished }, use) => {
    // Enclose the whole regression, including recovery after an expected failure.
    // Keep state and its response/runtime owners alive until the callback settles.
    void state;
    const workflow = createNodeRuntime({});
    try {
      await use(workflow.run);
    } finally {
      try {
        await workflow.close();
      } catch (error) {
        onTestFinished(() => {
          throw error;
        });
      }
    }
  },
  // biome-ignore lint/correctness/noEmptyPattern: Vitest requires destructured fixture dependencies.
  cleanupProbe: async ({}, use) => {
    const probe: CleanupProbe = { cancellations: 0, users: [] };
    await use(probe);
    // This fixture encloses state and its runtime/database dependencies.
    expect(probe.response).toBeDefined();
    expect(probe.cancellations).toBe(1);
    expect(probe.response?.bodyUsed).toBe(true);
    const db = createFixturePrisma();
    try {
      expect(probe.users).toHaveLength(4);
      expect(probe.database).toMatch(/^test_isolated_/);
      expect(
        await db.$queryRaw`
        SELECT datname FROM pg_database WHERE datname = ${probe.database}
      `,
      ).toEqual([]);
      expect(
        await db.$queryRaw`
        SELECT pid FROM pg_stat_activity WHERE datname = ${probe.database}
      `,
      ).toEqual([]);
    } finally {
      await db.$disconnect();
    }
  },
  _databaseResources: async ({ databaseTemplate, cleanupProbe }, use) => {
    const database = ownIsolatedDatabase(databaseTemplate);
    cleanupProbe.database = database.name;
    try {
      await use(database);
    } finally {
      await database.dispose();
    }
  },
});

it(
  "reclaims the wrapped response after background rejection and permits the next operation",
  { tags: ["@Infrastructure/Runtime"] },
  async ({ state, cleanupProbe, probeRun }) =>
    probeRun(async () => {
      cleanupProbe.users = [...state.users];
      const failure = new Error("domain background failed");
      await expect(
        state.runtime(async () => {
          getCloudflareRuntimeTaskScheduler()?.(Promise.reject(failure));
          cleanupProbe.response = new Response(
            new ReadableStream({
              cancel() {
                cleanupProbe.cancellations++;
              },
            }),
          );
          return cleanupProbe.response;
        }),
      ).rejects.toMatchObject({ errors: [failure] });
      expect(cleanupProbe.cancellations).toBe(0);
      expect(cleanupProbe.response?.body?.locked).toBe(true);
      await expect(
        state.runtime(async () => "healthy operation"),
      ).resolves.toBe("healthy operation");
    }),
);

it(
  "reclaims only the wrapped response after a successful operation",
  { tags: ["@Infrastructure/Runtime"] },
  async ({ state, cleanupProbe, probeRun }) =>
    probeRun(async () => {
      cleanupProbe.users = [...state.users];
      const response = await state.runtime(async () => {
        cleanupProbe.response = new Response(
          new ReadableStream({
            cancel() {
              cleanupProbe.cancellations++;
            },
          }),
        );
        return cleanupProbe.response;
      });
      expect(response).not.toBe(cleanupProbe.response);
      expect(cleanupProbe.response?.body?.locked).toBe(true);
      expect(response.body?.locked).toBe(false);
      expect(cleanupProbe.cancellations).toBe(0);
    }),
);
