import { isolatedDatabaseTest } from "./isolated-database";
import { createNodeRuntime } from "./node-runtime";
import type { TestPrismaClient } from "./prisma";

export type WorkspaceState = {
  db: TestPrismaClient;
  userId: string;
  runtime: ReturnType<typeof createNodeRuntime>["run"];
};

export const workspaceRuntimeTest = isolatedDatabaseTest.extend<{
  workspaceQueue: { send(message: unknown): Promise<void> };
  workspaceRuntime: ReturnType<typeof createNodeRuntime>;
}>({
  // Queue consumers and rate limits have separate Worker tests. These direct
  // domain contracts observe persistence and the producer's enqueue boundary.
  // biome-ignore lint/correctness/noEmptyPattern: Vitest requires destructured fixture dependencies.
  workspaceQueue: async ({}, use) => {
    await use({ send: async () => {} });
  },
  workspaceRuntime: async (
    { isolatedDatabase, workspaceQueue, onTestFinished },
    use,
  ) => {
    const { connections } = isolatedDatabase;
    const runtime = createNodeRuntime({
      APP_PUBLIC_ORIGIN: "http://localhost:3000",
      HYPERDRIVE: { connectionString: connections.app },
      HYPERDRIVE_AUTH: { connectionString: connections.auth },
      HYPERDRIVE_MAINTENANCE: { connectionString: connections.maintenance },
      USER_WRITE_RATE_LIMITER: { limit: async () => ({ success: true }) },
      USER_BATCH_WRITE_RATE_LIMITER: { limit: async () => ({ success: true }) },
      CALENDAR_EXPORT_REBUILD: workspaceQueue,
    });
    try {
      // Native teardown is registered before any actor or dependent setup starts.
      await use(runtime);
    } finally {
      try {
        await runtime.close();
      } catch (error) {
        onTestFinished(() => {
          throw error;
        });
      }
    }
  },
});

export const workspaceStateTest = workspaceRuntimeTest.extend<{
  workspace: WorkspaceState;
}>({
  workspace: async ({ isolatedDatabase, workspaceRuntime, task }, use) => {
    const db = isolatedDatabase.owner;
    const userId = "workspace-owner";
    await workspaceRuntime.run(() =>
      db.user.create({
        data: { id: userId, email: `${userId}@test.invalid` },
      }),
    );
    task.context.signal.throwIfAborted();
    await use({ db, userId, runtime: workspaceRuntime.run });
  },
});
