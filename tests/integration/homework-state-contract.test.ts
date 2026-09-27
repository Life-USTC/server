import { afterAll, beforeAll, expect, it } from "vitest";
import { setCalendarExportRebuildSenderForTest } from "@/features/calendar/server/calendar-export-queue";
import { setHomeworkCompletion } from "@/features/homeworks/server/homework-completion";
import { createHomeworkForSection } from "@/features/homeworks/server/homework-create";
import { updateHomework } from "@/features/homeworks/server/homework-mutations";
import { prisma, withUserDbContext } from "@/lib/db/prisma";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const users = Array.from({ length: 4 }, () => crypto.randomUUID());
const homeworkIds: string[] = [];
let sectionId: number;
beforeAll(async () => {
  setCalendarExportRebuildSenderForTest(async () => {});
  await db.user.createMany({
    data: users.map((id, index) => ({
      id,
      name: `Homework actor ${index}`,
      email: `${id}@test.invalid`,
      isAdmin: index === 2,
    })),
  });
  await db.userSuspension.create({
    data: {
      userId: users[3],
      createdById: users[2],
      reason: "Contract fixture",
    },
  });
  const course = await db.course.findFirstOrThrow({ select: { id: true } });
  const marker = 1_600_000_000 + Math.floor(Math.random() * 100_000_000);
  sectionId = (
    await db.section.create({
      data: { courseId: course.id, jwId: marker, code: `HOMEWORK.${marker}` },
    })
  ).id;
});
afterAll(async () => {
  setCalendarExportRebuildSenderForTest();
  await db.auditLog.deleteMany({ where: { userId: { in: users } } });
  await db.homework.deleteMany({ where: { id: { in: homeworkIds } } });
  if (sectionId) await db.section.delete({ where: { id: sectionId } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await Promise.all([db.$disconnect(), prisma.$disconnect()]);
});
async function create(index = 0) {
  const result = await createHomeworkForSection(users[index], {
    sectionId,
    title: `Shared assignment ${crypto.randomUUID()}`,
    description: "Original shared description",
    isMajor: true,
    requiresTeam: true,
    submissionDueAt: new Date("2031-01-15T12:00:00+08:00"),
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected homework creation");
  homeworkIds.push(result.homework.id);
  return result.homework;
}

it("homework.no-subscription-required", async () => {
  for (const index of [0, 1]) {
    expect(
      await db.userSectionSubscription.count({
        where: { userId: users[index] },
      }),
    ).toBe(0);
    const homework = await create(index);
    expect(
      await db.homework.findUniqueOrThrow({ where: { id: homework.id } }),
    ).toMatchObject({
      sectionId,
      createdById: users[index],
      title: homework.title,
    });
    expect(
      await db.userSectionSubscription.count({
        where: { userId: users[index] },
      }),
    ).toBe(0);
  }
});

it("homework.entity-and-completion-separated", async () => {
  const homework = await create();
  const snapshot = () =>
    db.homework.findUniqueOrThrow({
      where: { id: homework.id },
      include: { description: { include: { edits: true } } },
    });
  const original = await snapshot();
  const audits = await db.auditLog.findMany({
    where: { targetId: homework.id },
    orderBy: { id: "asc" },
  });
  for (const completed of [true, false, true]) {
    expect(
      await setHomeworkCompletion({
        userId: users[1],
        homeworkId: homework.id,
        completed,
      }),
    ).toMatchObject({ success: true, completed });
    expect(await snapshot()).toEqual(original);
    expect(
      await db.auditLog.findMany({
        where: { targetId: homework.id },
        orderBy: { id: "asc" },
      }),
    ).toEqual(audits);
  }
  const completion = await db.homeworkCompletion.findUniqueOrThrow({
    where: { userId_homeworkId: { userId: users[1], homeworkId: homework.id } },
  });
  expect(
    await updateHomework({
      userId: users[0],
      homeworkId: homework.id,
      update: {
        homeworkUpdates: { title: "Edited shared title" },
        description: "Edited shared description",
      },
    }),
  ).toEqual({ ok: true });
  expect(
    await db.homeworkCompletion.findUniqueOrThrow({
      where: {
        userId_homeworkId: { userId: users[1], homeworkId: homework.id },
      },
    }),
  ).toEqual(completion);
  expect(await snapshot()).toMatchObject({
    title: "Edited shared title",
    description: { content: "Edited shared description" },
  });
});

it("homework.completion-owner", async () => {
  const homework = await create();
  expect(
    await setHomeworkCompletion({
      userId: users[0],
      homeworkId: homework.id,
      completed: true,
    }),
  ).toMatchObject({ success: true });
  const ownerState = await db.homeworkCompletion.findUniqueOrThrow({
    where: { userId_homeworkId: { userId: users[0], homeworkId: homework.id } },
  });
  for (const foreign of [users[1], users[2]]) {
    expect(
      await withUserDbContext(foreign, (tx) =>
        tx.homeworkCompletion.findMany({ where: { homeworkId: homework.id } }),
      ),
    ).toEqual([]);
    expect(
      await setHomeworkCompletion({
        userId: foreign,
        homeworkId: homework.id,
        completed: false,
      }),
    ).toMatchObject({ success: true, completed: false });
    expect(
      await withUserDbContext(foreign, (tx) =>
        tx.homeworkCompletion.updateMany({
          where: { userId: users[0], homeworkId: homework.id },
          data: { completedAt: new Date() },
        }),
      ),
    ).toEqual({ count: 0 });
    expect(
      await withUserDbContext(foreign, (tx) =>
        tx.homeworkCompletion.deleteMany({
          where: { userId: users[0], homeworkId: homework.id },
        }),
      ),
    ).toEqual({ count: 0 });
    await expect(
      withUserDbContext(foreign, (tx) =>
        tx.homeworkCompletion.create({
          data: { userId: users[0], homeworkId: homework.id },
        }),
      ),
    ).rejects.toThrow();
    expect(
      await db.homeworkCompletion.findUniqueOrThrow({
        where: {
          userId_homeworkId: { userId: users[0], homeworkId: homework.id },
        },
      }),
    ).toEqual(ownerState);
  }
  expect(
    await setHomeworkCompletion({
      userId: users[0],
      homeworkId: homework.id,
      completed: false,
    }),
  ).toMatchObject({ success: true, completed: false });
  expect(
    await db.homeworkCompletion.count({ where: { homeworkId: homework.id } }),
  ).toBe(0);
});

it("homework.active-collaborator-write", async () => {
  const homework = await create();
  for (const index of [1, 2]) {
    const own = await create(index);
    expect(own.createdById).toBe(users[index]);
    expect(
      await updateHomework({
        userId: users[index],
        homeworkId: homework.id,
        update: { homeworkUpdates: { title: `Collaborator ${index}` } },
      }),
    ).toEqual({ ok: true });
    expect(
      await db.homework.findUniqueOrThrow({ where: { id: homework.id } }),
    ).toMatchObject({ title: `Collaborator ${index}`, createdById: users[0] });
  }
  const before = await db.homework.findMany({
    where: { sectionId },
    orderBy: { id: "asc" },
  });
  for (const [userId, error] of [
    [users[3], "suspended"],
    ["", "forbidden"],
    [crypto.randomUUID(), "forbidden"],
  ]) {
    expect(
      await createHomeworkForSection(userId, {
        sectionId,
        title: "Rejected creation",
        isMajor: false,
        requiresTeam: false,
      }),
    ).toMatchObject({ ok: false, error });
    expect(
      await updateHomework({
        userId,
        homeworkId: homework.id,
        update: { homeworkUpdates: { title: "Rejected update" } },
      }),
    ).toMatchObject({ ok: false, error });
  }
  expect(
    await db.homework.findMany({
      where: { sectionId },
      orderBy: { id: "asc" },
    }),
  ).toEqual(before);
});
