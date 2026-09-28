import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { isolatedDatabaseTest } from "./isolated-database";
import type { TestPrismaClient } from "./prisma";

export type CalendarCommitState = {
  db: TestPrismaClient;
  userId: string;
  sectionId: number;
  youngId: string;
  messages: unknown[];
  run<T>(work: () => Promise<T>, onMessage?: () => Promise<void>): Promise<T>;
};

export const test = isolatedDatabaseTest.extend<{
  calendar: CalendarCommitState;
}>({
  calendar: async ({ isolatedDatabase: { owner: db, connections } }, use) => {
    const userId = crypto.randomUUID();
    const youngId = crypto.randomUUID();
    const sectionId = await db.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: userId,
          email: `${userId}@test.invalid`,
          name: "Calendar owner",
        },
      });
      const course = await tx.course.create({
        data: { jwId: 1, code: "CALENDAR", nameCn: "Calendar course" },
      });
      const section = await tx.section.create({
        data: { jwId: 1, code: "CALENDAR.01", courseId: course.id },
      });
      await tx.youngEvent.create({
        data: { youngId, name: "Calendar event", isActive: true, rawJson: {} },
      });
      return section.id;
    });
    const messages: unknown[] = [];
    await use({
      db,
      userId,
      sectionId,
      youngId,
      messages,
      run: async (work, onMessage) => {
        const tasks: Promise<PromiseSettledResult<unknown>>[] = [];
        return runWithCloudflareRuntimeEnv(
          {
            HYPERDRIVE: { connectionString: connections.app },
            HYPERDRIVE_AUTH: { connectionString: connections.auth },
            HYPERDRIVE_MAINTENANCE: {
              connectionString: connections.maintenance,
            },
            CALENDAR_EXPORT_REBUILD: {
              send: async (message: unknown) => {
                messages.push(structuredClone(message));
                await onMessage?.();
              },
            },
          },
          async () => {
            const [result] = await Promise.allSettled([
              Promise.resolve().then(work),
            ]);
            const errors: unknown[] = [];
            // Complete request-local background work before runtime clients close,
            // including rejection paths and work scheduled by another task.
            for (let next = 0; next < tasks.length; ) {
              const batch = tasks.slice(next);
              next += batch.length;
              for (const task of await Promise.all(batch))
                if (task.status === "rejected") errors.push(task.reason);
            }
            if (result.status === "rejected") errors.unshift(result.reason);
            if (errors.length === 1) throw errors[0];
            if (errors.length)
              throw new AggregateError(
                errors,
                "Calendar request and background work failed",
              );
            if (result.status === "fulfilled") return result.value;
            throw new Error("Calendar request did not settle");
          },
          {
            waitUntil: (task: Promise<unknown>) =>
              tasks.push(
                task.then(
                  (value): PromiseFulfilledResult<unknown> => ({
                    status: "fulfilled",
                    value,
                  }),
                  (reason): PromiseRejectedResult => ({
                    status: "rejected",
                    reason,
                  }),
                ),
              ),
          },
        );
      },
    });
  },
});
