import { afterAll, beforeAll, expect, it } from "vitest";
import { getIncompleteHomeworkCalendarItems } from "@/features/calendar/server/calendar-export-data";
import { listSubscribedHomeworkPage } from "@/features/subscriptions/server/subscription-homework-page";
import { updateSubscriptionKind } from "@/features/subscriptions/server/subscription-kind";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const users = [crypto.randomUUID(), crypto.randomUUID()];
const ids = Array.from({ length: 4 }, () => crypto.randomUUID());
const now = new Date("2026-09-13T08:00:00Z");
const future = new Date(now.getTime() + 60_000);
let section: { id: number; jwId: number };

beforeAll(async () => {
  const source = await db.section.findFirstOrThrow({
    where: { retiredAt: null },
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
      sectionId: section.id,
      kind: index === 0 ? "teaching_assistant" : "regular",
    })),
  });
  await db.homework.createMany({
    data: ids.map((id, index) => ({
      id,
      title: `[integration-test] TA state ${index}`,
      sectionId: section.id,
      submissionDueAt: index === 2 ? null : index === 1 ? future : now,
    })),
  });
  await db.homeworkCompletion.create({
    data: { userId: users[0], homeworkId: ids[3], completedAt: now },
  });
});

afterAll(async () => {
  if (section) await db.section.delete({ where: { id: section.id } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});

function read(userId: string, completed?: boolean, pageSize = 20) {
  return listSubscribedHomeworkPage(userId, {
    completed,
    now,
    pagination: { page: 1, pageSize },
  });
}

it("derives TA pending membership before pagination and preserves actual completion across role/deadline changes", async () => {
  const pending = await read(users[0], false, 1);
  expect(pending.pagination.total).toBe(2);
  expect(pending.data).toHaveLength(1);
  expect(pending.data[0].id).toBe(ids[1]);
  expect(pending.data[0].completionRequired).toBe(false);

  expect(
    (await getIncompleteHomeworkCalendarItems(users[0], [section.id], now)).map(
      (homework) => homework.id,
    ),
  ).toEqual([ids[1]]);

  const all = await read(users[0]);
  expect(all.pagination.total).toBe(4);
  expect(
    all.data.every((homework) => homework.completionRequired === false),
  ).toBe(true);
  expect(
    all.data.find((homework) => homework.id === ids[3])?.completion,
  ).not.toBeNull();
  expect(
    (await read(users[0], true)).data.map((homework) => homework.id),
  ).toEqual([ids[3]]);
  expect((await read(users[1], false)).pagination.total).toBe(4);
  expect(
    (await read(users[1])).data.every(
      (homework) => homework.completionRequired,
    ),
  ).toBe(true);

  await db.homework.update({
    where: { id: ids[0] },
    data: { submissionDueAt: future },
  });
  expect((await read(users[0], false)).pagination.total).toBe(3);
  await db.homework.update({
    where: { id: ids[0] },
    data: { submissionDueAt: null },
  });
  expect((await read(users[0], false)).pagination.total).toBe(3);
  await db.homework.update({
    where: { id: ids[0] },
    data: { submissionDueAt: now },
  });
  expect((await read(users[0], false)).pagination.total).toBe(2);

  await updateSubscriptionKind({
    userId: users[0],
    sectionJwId: section.jwId,
    kind: "auditor",
  });
  expect((await read(users[0], false)).pagination.total).toBe(3);
  expect(
    (await read(users[0])).data.every(
      (homework) => homework.completionRequired,
    ),
  ).toBe(true);
  await updateSubscriptionKind({
    userId: users[0],
    sectionJwId: section.jwId,
    kind: "teaching_assistant",
  });
  expect((await read(users[0], false)).pagination.total).toBe(2);
  expect(
    await db.homeworkCompletion.findMany({
      where: { userId: users[0] },
      select: { homeworkId: true, completedAt: true },
    }),
  ).toEqual([{ homeworkId: ids[3], completedAt: now }]);
});
