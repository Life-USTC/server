import { readFile } from "node:fs/promises";
import { parseConfigFileTextToJson } from "typescript";
import { vi } from "vitest";
import { listYoungNotifications } from "@/features/young/server/young-notification-service";
import { setYoungEventSubscription } from "@/features/young/server/young-subscription-service";
import { nodeProtocolTest } from "../shared/node-protocol-fixture";

// The scheduled path does not use the HTTP application or Durable Object base.
vi.mock("cloudflare:workers", () => ({ WorkerEntrypoint: class {} }));
vi.mock("life-ustc-sveltekit-worker", () => ({ default: { fetch: vi.fn() } }));

import worker from "@/worker";

const now = new Date("2030-09-15T10:00:00+08:00");
const it = nodeProtocolTest.extend<{ clock: undefined }>({
  // The actual Worker scheduled entry point uses Date, not scheduledTime.
  // Vitest isolates this file/worker; one native case owns its global Date.
  // This does not support arbitrary same-realm concurrent execution.
  clock: [
    async ({ protocolRuntime }, use) => {
      try {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(now);
        await use(undefined);
      } finally {
        // Keep Date fixed through admitted scheduled work and background cleanup.
        // The runtime owner reports its cached cleanup failure afterward.
        await Promise.allSettled([protocolRuntime.close()]);
        vi.useRealTimers();
      }
    },
    { auto: true },
  ],
});

it("young-workspace.reminder-generation", async ({
  isolatedDatabase,
  protocolRuntime,
  expect,
}) => {
  await protocolRuntime.run(async () => {
    const { owner: db, connections } = isolatedDatabase;
    const users = [crypto.randomUUID(), crypto.randomUUID()];
    const youngId = `cron-${crypto.randomUUID()}`;
    await db.$transaction(async (tx) => {
      await tx.user.createMany({
        data: users.map((id) => ({
          id,
          name: "Scheduled reminders",
          email: `${id}@test.invalid`,
        })),
      });
      await tx.youngEvent.create({
        data: {
          youngId,
          name: "Scheduled event",
          isActive: true,
          rawJson: {},
          startAt: new Date("2030-09-15T10:30:00+08:00"),
        },
      });
    });
    await protocolRuntime.request(async () => {
      for (const userId of users)
        await setYoungEventSubscription(userId, youngId, true, {
          remindSignup: false,
          remindDeadline: false,
          remindStart: true,
        });
    });
    const parsed = parseConfigFileTextToJson(
      "wrangler.jsonc",
      await readFile(new URL("../../wrangler.jsonc", import.meta.url), "utf8"),
    );
    expect(parsed.error).toBeUndefined();
    const cron = "*/10 * * * *";
    expect(parsed.config.triggers.crons).toContain(cron);
    expect(
      await db.youngNotification.count({ where: { userId: { in: users } } }),
    ).toBe(0);
    const bindings = {
      HYPERDRIVE: { connectionString: connections.app },
      HYPERDRIVE_MAINTENANCE: {
        connectionString: connections.maintenance,
      },
      CALENDAR_EXPORT_REBUILD: { send: async () => {} },
    };
    const scheduled = async () => {
      const tasks: Promise<PromiseSettledResult<unknown>>[] = [];
      const [outcome] = await Promise.allSettled([
        worker.scheduled(
          { cron, scheduledTime: now.getTime(), type: "scheduled" },
          bindings,
          {
            waitUntil: (task: Promise<unknown>) => {
              tasks.push(
                task.then(
                  (value) => ({ status: "fulfilled" as const, value }),
                  (reason) => ({ status: "rejected" as const, reason }),
                ),
              );
            },
          },
        ),
      ]);
      const failures: unknown[] = [];
      for (let index = 0; index < tasks.length; index++) {
        const result = await tasks[index];
        if (result.status === "rejected") failures.push(result.reason);
      }
      if (outcome.status === "rejected") failures.unshift(outcome.reason);
      if (failures.length)
        throw new AggregateError(failures, "Scheduled work failed");
    };
    await protocolRuntime.request(scheduled);
    const rows = await db.youngNotification.findMany({
      where: { userId: { in: users } },
      orderBy: { userId: "asc" },
    });
    expect(
      rows.map((row) => ({
        userId: row.userId,
        youngId: row.youngId,
        kind: row.kind,
      })),
    ).toEqual(
      [...users]
        .sort()
        .map((userId) => ({ userId, youngId, kind: "event_start" })),
    );
    await protocolRuntime.request(scheduled);
    expect(
      (
        await db.youngNotification.findMany({
          where: { userId: { in: users } },
          orderBy: { userId: "asc" },
        })
      ).map((row) => row.id),
    ).toEqual(rows.map((row) => row.id));
    await db.youngNotification.deleteMany({ where: { userId: users[0] } });
    await protocolRuntime.request(async () => {
      const listed = await listYoungNotifications(users[0], {}, now);
      expect(listed.data).toHaveLength(1);
      expect(listed.data[0]).toMatchObject({ youngId, kind: "event_start" });
      expect(
        await db.youngNotification.count({ where: { userId: users[0] } }),
      ).toBe(1);
    });
  });
});
