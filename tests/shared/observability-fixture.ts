import { runWithObservability } from "@/lib/db/observability-context";
import { metricsTest } from "./metrics-fixture";
import type { TestPrismaClient } from "./prisma";
import { runWorkspaceRuntime } from "./workspace-state-fixture";

type Observation = {
  db: TestPrismaClient;
  maintenance: TestPrismaClient;
  userId: string;
  runtime(work: () => void | Promise<void>): Promise<void>;
  capture<T>(work: () => T | Promise<T>): Promise<T>;
};

export const observabilityTest = metricsTest.extend<{
  observation: Observation;
}>({
  observation: async ({ metrics, isolatedDatabase }, use) => {
    const { db } = metrics;
    const { connections, maintenance } = isolatedDatabase;
    const userId = `observation-${crypto.randomUUID()}`;
    const responses: Response[] = [];
    async function capture<T>(work: () => T | Promise<T>): Promise<T> {
      const tasks: Promise<PromiseSettledResult<unknown>>[] = [];
      const [outcome] = await Promise.allSettled([
        runWithObservability(work, (task) => {
          tasks.push(
            task.then(
              (value) => ({ status: "fulfilled" as const, value }),
              (reason) => ({ status: "rejected" as const, reason }),
            ),
          );
        }),
      ]);
      if (outcome.status === "fulfilled" && outcome.value instanceof Response)
        responses.push(outcome.value);
      const failures: unknown[] = [];
      for (let index = 0; index < tasks.length; index++) {
        const result = await tasks[index];
        if (result.status === "rejected") failures.push(result.reason);
      }
      if (outcome.status === "rejected") {
        if (!failures.length) throw outcome.reason;
        throw new AggregateError(
          [outcome.reason, ...failures],
          "Observation and background work failed",
        );
      }
      if (failures.length)
        throw new AggregateError(
          failures,
          "Observation background work failed",
        );
      return outcome.value;
    }
    async function cleanup() {
      // The tests inspect bodyUsed before cleanup; an assertion failure must
      // still release the original response without consuming it in capture().
      const results = await Promise.allSettled(
        responses.map((response) =>
          response.body && !response.bodyUsed
            ? response.body.cancel()
            : undefined,
        ),
      );
      const failures = results.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (failures.length)
        throw new AggregateError(
          failures,
          "Observation response cleanup failed",
        );
    }
    try {
      await db.user.create({
        data: { id: userId, email: `${userId}@test.invalid` },
      });
      await use({
        db,
        maintenance,
        userId,
        capture,
        runtime: (work) =>
          runWorkspaceRuntime(work, {
            app: connections.app,
            maintenance: connections.maintenance,
          }),
      });
    } finally {
      await cleanup();
    }
  },
});
