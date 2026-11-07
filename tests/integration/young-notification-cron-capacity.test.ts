import pg from "pg";
import { vi } from "vitest";
import { setYoungEventSubscription } from "@/features/young/server/young-subscription-service";
import { nodeProtocolTest as it } from "../shared/node-protocol-fixture";

vi.mock("cloudflare:workers", () => ({ WorkerEntrypoint: class {} }));
vi.mock("life-ustc-sveltekit-worker", () => ({ default: { fetch: vi.fn() } }));

import worker from "@/worker";

it("keeps scheduled owner transactions within the pool while real row locks delay admitted owners", {
  tags: ["@Young/Runtime"],
}, async ({ isolatedDatabase, protocolRuntime, expect }) => {
  await protocolRuntime.run(async () => {
    const { owner: db, connections } = isolatedDatabase;
    const nonce = crypto.randomUUID();
    const users = Array.from(
      { length: 5 },
      (_, index) => `capacity-${index}-${nonce}`,
    );
    const youngId = `capacity-event-${nonce}`;
    const now = new Date();
    await db.user.createMany({
      data: users.map((id) => ({
        id,
        name: "Capacity owner",
        email: `${id}@test.invalid`,
      })),
    });
    await db.youngEvent.create({
      data: {
        youngId,
        name: "Capacity event",
        isActive: true,
        rawJson: {},
        startAt: new Date(now.getTime() + 30 * 60_000),
      },
    });
    await protocolRuntime.request(async () => {
      for (const userId of users)
        await setYoungEventSubscription(userId, youngId, true, {
          remindSignup: false,
          remindDeadline: false,
          remindStart: true,
        });
    });
    const before = await db.userYoungEventSubscription.findMany({
      orderBy: { userId: "asc" },
    });
    const locker = new pg.Client({ connectionString: connections.owner });
    await locker.connect();
    let locked = false;
    let releaseTimer: ReturnType<typeof setTimeout> | undefined;
    let pending:
      | Promise<{ ok: true } | { ok: false; error: unknown }>
      | undefined;
    const bindings = {
      HYPERDRIVE: { connectionString: connections.app },
      HYPERDRIVE_MAINTENANCE: { connectionString: connections.maintenance },
      CALENDAR_EXPORT_REBUILD: { send: async () => {} },
    };
    const scheduled = async () => {
      const tasks: Promise<PromiseSettledResult<unknown>>[] = [];
      const [outcome] = await Promise.allSettled([
        worker.scheduled(
          {
            cron: "*/10 * * * *",
            scheduledTime: Date.now(),
            type: "scheduled",
          },
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
        throw new AggregateError(failures, "Scheduled capacity work failed");
    };
    try {
      await locker.query("BEGIN");
      await locker.query(
        'SELECT "id" FROM "User" WHERE "id" = ANY($1::text[]) ORDER BY "id" FOR UPDATE',
        [users.slice(0, 3)],
      );
      locked = true;
      pending = protocolRuntime.request(scheduled).then(
        () => ({ ok: true as const }),
        (error: unknown) => ({ ok: false as const, error }),
      );
      await expect
        .poll(async () => {
          const rows = await db.$queryRaw<
            Array<{ count: number }>
          >`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%FOR UPDATE%' AND pid <> pg_backend_pid()`;
          return rows[0]?.count;
        })
        .toBe(3);
      const released = new Promise<void>((resolve, reject) => {
        releaseTimer = setTimeout(() => {
          void locker.query("COMMIT").then(() => {
            locked = false;
            resolve();
          }, reject);
        }, 2_100);
      });
      const result = await pending;
      await released;
      if (!result.ok) throw result.error;
      const notifications = await db.youngNotification.findMany({
        orderBy: { userId: "asc" },
      });
      expect(
        notifications.map(({ userId, kind, youngId }) => ({
          userId,
          kind,
          youngId,
        })),
      ).toEqual(
        users.map((userId) => ({ userId, kind: "event_start", youngId })),
      );
      expect(
        await db.userYoungEventSubscription.findMany({
          orderBy: { userId: "asc" },
        }),
      ).toEqual(before);
      await protocolRuntime.request(scheduled);
      expect(
        (
          await db.youngNotification.findMany({ orderBy: { userId: "asc" } })
        ).map(({ id }) => id),
      ).toEqual(notifications.map(({ id }) => id));
    } finally {
      if (releaseTimer) clearTimeout(releaseTimer);
      if (locked) await locker.query("ROLLBACK");
      await pending;
      await locker.end();
    }
  });
});
