import { readFile } from "node:fs/promises";
import { parseConfigFileTextToJson } from "typescript";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { setCalendarExportRebuildSenderForTest } from "@/features/calendar/server/calendar-export-queue";
import { listYoungNotifications } from "@/features/young/server/young-notification-service";
import { setYoungEventSubscription } from "@/features/young/server/young-subscription-service";
import { prisma } from "@/lib/db/prisma";
import { createFixturePrisma } from "../shared/prisma";

// The scheduled path does not use the HTTP application or Durable Object base.
vi.mock("cloudflare:workers", () => ({ WorkerEntrypoint: class {} }));
vi.mock("life-ustc-sveltekit-worker", () => ({ default: { fetch: vi.fn() } }));

import worker from "@/worker";

const db = createFixturePrisma();
const users = [crypto.randomUUID(), crypto.randomUUID()];
const youngId = `cron-${crypto.randomUUID()}`;
const now = new Date("2030-09-15T10:00:00+08:00");

beforeAll(async () => {
  setCalendarExportRebuildSenderForTest(async () => {});
  await db.user.createMany({
    data: users.map((id) => ({
      id,
      name: "Scheduled reminders",
      email: `${id}@test.invalid`,
    })),
  });
  await db.youngEvent.create({
    data: {
      youngId,
      name: "Scheduled event",
      isActive: true,
      rawJson: {},
      startAt: new Date("2030-09-15T10:30:00+08:00"),
    },
  });
  for (const userId of users)
    await setYoungEventSubscription(userId, youngId, true, {
      remindSignup: false,
      remindDeadline: false,
      remindStart: true,
    });
});
afterAll(async () => {
  vi.useRealTimers();
  setCalendarExportRebuildSenderForTest();
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.youngEvent.deleteMany({ where: { youngId } });
  await Promise.all([db.$disconnect(), prisma.$disconnect()]);
});

it("young-workspace.reminder-generation", async () => {
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
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  const bindings = {
    HYPERDRIVE: { connectionString: process.env.DATABASE_URL },
    HYPERDRIVE_MAINTENANCE: {
      connectionString: process.env.MAINTENANCE_DATABASE_URL,
    },
  };
  await worker.scheduled(
    { cron, scheduledTime: now.getTime(), type: "scheduled" },
    bindings,
    { waitUntil: vi.fn() },
  );
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
  await worker.scheduled(
    { cron, scheduledTime: now.getTime(), type: "scheduled" },
    bindings,
    { waitUntil: vi.fn() },
  );
  expect(
    (
      await db.youngNotification.findMany({
        where: { userId: { in: users } },
        orderBy: { userId: "asc" },
      })
    ).map((row) => row.id),
  ).toEqual(rows.map((row) => row.id));
  await db.youngNotification.deleteMany({ where: { userId: users[0] } });
  const listed = await listYoungNotifications(users[0], {}, now);
  expect(listed.data).toHaveLength(1);
  expect(listed.data[0]).toMatchObject({ youngId, kind: "event_start" });
  expect(
    await db.youngNotification.count({ where: { userId: users[0] } }),
  ).toBe(1);
});
