import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { getIncompleteHomeworkCalendarItems } from "@/features/calendar/server/calendar-export-data";
import { listSubscribedHomeworkPage } from "@/features/subscriptions/server/subscription-homework-page";
import { updateSubscriptionKind } from "@/features/subscriptions/server/subscription-kind";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import { DEV_SEED } from "../fixtures/dev-seed";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const now = new Date("2026-09-13T08:00:00Z");
const future = new Date(now.getTime() + 60_000);
let users: string[] = [];
let ids: string[] = [];
let section: { id: number; jwId: number } | undefined;

beforeEach(async () => {
  users = [crypto.randomUUID(), crypto.randomUUID()];
  ids = Array.from({ length: 4 }, () => crypto.randomUUID());
  section = undefined;
  const source = await db.section.findUniqueOrThrow({
    where: { jwId: DEV_SEED.section.jwId },
    select: { courseId: true, semesterId: true },
  });
  section = await db.section.create({
    data: {
      ...source,
      jwId: -Math.floor(Math.random() * 1_000_000_000) - 1,
      code: `[integration-test] ta-${crypto.randomUUID()}`,
    },
    select: { id: true, jwId: true },
  });
  await db.user.createMany({
    data: users.map((id) => ({
      id,
      name: "TA homework test",
      email: `${id}@ta.test`,
    })),
  });
  await db.userSectionSubscription.createMany({
    data: users.map((userId, index) => ({
      userId,
      sectionId: sectionId(),
      kind: index === 0 ? "teaching_assistant" : "regular",
    })),
  });
  await db.homework.createMany({
    data: ids.map((id, index) => ({
      id,
      title: `[integration-test] TA state ${index}`,
      sectionId: sectionId(),
      submissionDueAt: index === 2 ? null : index === 1 ? future : now,
    })),
  });
  await db.homeworkCompletion.create({
    data: { userId: users[0], homeworkId: ids[3], completedAt: now },
  });
});

afterEach(async () => {
  if (section) await db.section.deleteMany({ where: { id: section.id } });
  await db.auditLog.deleteMany({ where: { userId: { in: users } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
});
afterAll(async () => {
  await Promise.all([db.$disconnect(), runtimePrisma.$disconnect()]);
});

function sectionId() {
  if (!section) throw new Error("Missing isolated section");
  return section.id;
}
function read(userId: string, completed?: boolean, pageSize = 20) {
  return listSubscribedHomeworkPage(userId, {
    completed,
    now,
    pagination: { page: 1, pageSize },
  });
}
async function expectCompletionPreserved() {
  expect(
    await db.homeworkCompletion.findMany({
      where: { homeworkId: { in: ids } },
      select: { userId: true, homeworkId: true, completedAt: true },
    }),
  ).toEqual([{ userId: users[0], homeworkId: ids[3], completedAt: now }]);
}

describe("known homework state consumers", () => {
  it("filters TA deadlines before pagination and excludes undated work from calendar", async () => {
    const pending = await read(users[0], false, 1);
    expect(pending.pagination.total).toBe(2);
    expect(pending.data).toHaveLength(1);
    expect(pending.data[0]).toMatchObject({
      id: ids[1],
      completionRequired: false,
    });
    expect(
      (
        await getIncompleteHomeworkCalendarItems(users[0], [sectionId()], now)
      ).map((row) => row.id),
    ).toEqual([ids[1]]);
  });

  it("shows real TA completion independently of the completion requirement", async () => {
    const all = await read(users[0]);
    expect(all.pagination.total).toBe(4);
    expect(
      all.data
        .map((row) => ({
          id: row.id,
          completionRequired: row.completionRequired,
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    ).toEqual(
      ids
        .map((id) => ({ id, completionRequired: false }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    );
    expect(
      all.data.find((row) => row.id === ids[3])?.completion,
    ).not.toBeNull();
    expect((await read(users[0], true)).data.map((row) => row.id)).toEqual([
      ids[3],
    ]);
    await expectCompletionPreserved();
  });

  it("keeps a regular subscriber's pending work independent of another owner's completion", async () => {
    const pending = await read(users[1], false);
    expect(pending.pagination.total).toBe(4);
    expect(pending.data.map((row) => row.id).sort()).toEqual([...ids].sort());
    expect(
      pending.data.every(
        (row) => row.completionRequired && row.completion === null,
      ),
    ).toBe(true);
    expect((await read(users[1], true)).data).toEqual([]);
    await expectCompletionPreserved();
  });

  it.each([
    { name: "before now", dueAt: new Date(now.getTime() - 1), include: false },
    { name: "at now", dueAt: now, include: false },
    { name: "in the future", dueAt: future, include: true },
    { name: "without a deadline", dueAt: null, include: true },
  ])(
    "projects TA work $name without modifying completion",
    async ({ dueAt, include }) => {
      await db.homework.update({
        where: { id: ids[0] },
        data: { submissionDueAt: dueAt },
      });
      const expected = include ? [ids[0], ids[1], ids[2]] : [ids[1], ids[2]];
      const pending = await read(users[0], false);
      expect(pending.pagination.total).toBe(expected.length);
      expect(pending.data.map((row) => row.id).sort()).toEqual(expected.sort());
      await expectCompletionPreserved();
    },
  );
});

it.each([
  {
    before: "teaching_assistant",
    after: "auditor",
    pendingBefore: 2,
    pendingAfter: 3,
    required: true,
  },
  {
    before: "auditor",
    after: "teaching_assistant",
    pendingBefore: 3,
    pendingAfter: 2,
    required: false,
  },
] as const)(
  "changing $before to $after updates consumers and preserves completion",
  async (scenario) => {
    await db.userSectionSubscription.update({
      where: { userId_sectionId: { userId: users[0], sectionId: sectionId() } },
      data: { kind: scenario.before },
    });
    expect((await read(users[0], false)).pagination.total).toBe(
      scenario.pendingBefore,
    );
    if (!section) throw new Error("Missing isolated section");
    await updateSubscriptionKind({
      userId: users[0],
      sectionJwId: section.jwId,
      kind: scenario.after,
    });
    expect(
      await db.userSectionSubscription.findMany({
        where: { sectionId: section.id },
        select: { userId: true, kind: true },
        orderBy: { userId: "asc" },
      }),
    ).toEqual(
      [
        { userId: users[0], kind: scenario.after },
        { userId: users[1], kind: "regular" },
      ].sort((a, b) => a.userId.localeCompare(b.userId)),
    );
    expect((await read(users[0], false)).pagination.total).toBe(
      scenario.pendingAfter,
    );
    expect(
      (await read(users[0])).data.every(
        (row) => row.completionRequired === scenario.required,
      ),
    ).toBe(true);
    await expectCompletionPreserved();
  },
);
