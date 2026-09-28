import { test } from "vitest";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { createFixturePrisma, type TestPrismaClient } from "./prisma";

// Call around the test body: fixture use() does not propagate AsyncLocalStorage.
export async function runWorkspaceRuntime(
  work: () => void | Promise<void>,
  options: {
    app?: string;
    maintenance?: string;
    send?: (message: unknown) => Promise<void>;
  } = {},
) {
  const connection = options.app ?? process.env.DATABASE_URL;
  if (!connection)
    throw new Error("Workspace tests require an app database URL");
  const tasks: Promise<PromiseSettledResult<unknown>>[] = [];
  await runWithCloudflareRuntimeEnv(
    {
      APP_PUBLIC_ORIGIN: "http://localhost:3000",
      HYPERDRIVE: { connectionString: connection },
      HYPERDRIVE_MAINTENANCE: {
        connectionString:
          options.maintenance ?? process.env.MAINTENANCE_DATABASE_URL,
      },
      // These are domain/transport contracts; limiter behavior has its own
      // binding tests. Give this request its own successful limiter binding.
      USER_WRITE_RATE_LIMITER: { limit: async () => ({ success: true }) },
      USER_BATCH_WRITE_RATE_LIMITER: {
        limit: async () => ({ success: true }),
      },
      CALENDAR_EXPORT_REBUILD: { send: options.send ?? (async () => {}) },
    },
    async () => {
      const [outcome] = await Promise.allSettled([
        Promise.resolve().then(work),
      ]);
      const failures: unknown[] = [];
      for (let index = 0; index < tasks.length; index++) {
        const result = await tasks[index];
        if (result.status === "rejected") failures.push(result.reason);
      }
      if (outcome.status === "rejected") failures.unshift(outcome.reason);
      if (failures.length)
        throw new AggregateError(failures, "Workspace work failed");
    },
    {
      waitUntil: (task: Promise<unknown>) => {
        // Observe rejection immediately, even while the test awaits other work.
        tasks.push(
          task.then(
            (value) => ({ status: "fulfilled" as const, value }),
            (reason) => ({ status: "rejected" as const, reason }),
          ),
        );
      },
    },
  );
}

export type WorkspaceState = {
  db: TestPrismaClient;
  userId: string;
  runtime: typeof runWorkspaceRuntime;
};

export const workspaceStateTest = test.extend<{ workspace: WorkspaceState }>({
  // biome-ignore lint/correctness/noEmptyPattern: Vitest requires destructured fixture dependencies.
  workspace: async ({}, use) => {
    const db = createFixturePrisma();
    const userId = `workspace-${crypto.randomUUID()}`;
    try {
      await db.user.create({
        data: { id: userId, email: `${userId}@test.invalid` },
      });
      await use({ db, userId, runtime: runWorkspaceRuntime });
    } finally {
      try {
        await db.$transaction(async (tx) => {
          await tx.auditLog.deleteMany({
            where: { OR: [{ userId }, { subjectUserId: userId }] },
          });
          await tx.featureOperationEvent.deleteMany({ where: { userId } });
          await tx.user.deleteMany({ where: { id: userId } });
        });
      } finally {
        await db.$disconnect();
      }
    }
  },
});
