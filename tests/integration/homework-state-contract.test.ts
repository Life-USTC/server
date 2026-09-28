import { expect } from "vitest";
import { setHomeworkCompletion } from "@/features/homeworks/server/homework-completion";
import { createHomeworkForSection } from "@/features/homeworks/server/homework-create";
import { updateHomework } from "@/features/homeworks/server/homework-mutations";
import { withUserDbContext } from "@/lib/db/prisma";
import {
  type DomainState,
  domainStateTest,
} from "../shared/domain-state-fixture";

function homeworkHelpers(state: DomainState, sectionId: number) {
  const { users } = state;
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
    return result.homework;
  }

  return { ...state, sectionId, create };
}
const it = domainStateTest.extend<{
  suspendedIsAdmin: boolean;
  homework: ReturnType<typeof homeworkHelpers>;
}>({
  suspendedIsAdmin: false,
  homework: async ({ state }, use) => {
    const { db, marker } = state;
    const section = await db.section.create({
      data: {
        course: {
          create: { jwId: 101, code: "HOMEWORK", nameCn: "独立作业课程" },
        },
        jwId: 102,
        code: `HOMEWORK.${marker}`,
      },
    });
    await use(homeworkHelpers(state, section.id));
  },
});

it("homework.no-subscription-required", async ({ homework }) => {
  const { db, users, sectionId, create } = homework;
  await homework.runtime(async () => {
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
});

it("homework.entity-and-completion-separated", async ({ homework }) => {
  const { db, users, create } = homework;
  await homework.runtime(async () => {
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
      where: {
        userId_homeworkId: { userId: users[1], homeworkId: homework.id },
      },
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
});

it("homework.completion-owner", async ({ homework }) => {
  const { db, users, create } = homework;
  await homework.runtime(async () => {
    const homework = await create();
    expect(
      await setHomeworkCompletion({
        userId: users[0],
        homeworkId: homework.id,
        completed: true,
      }),
    ).toMatchObject({ success: true });
    const ownerState = await db.homeworkCompletion.findUniqueOrThrow({
      where: {
        userId_homeworkId: { userId: users[0], homeworkId: homework.id },
      },
    });
    for (const foreign of [users[1], users[2]]) {
      expect(
        await withUserDbContext(foreign, (tx) =>
          tx.homeworkCompletion.findMany({
            where: { homeworkId: homework.id },
          }),
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
});

it("homework.active-collaborator-write", async ({ homework }) => {
  const { db, users, sectionId, create } = homework;
  await homework.runtime(async () => {
    expect(
      await db.user.findUniqueOrThrow({ where: { id: users[3] } }),
    ).toMatchObject({ isAdmin: false });
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
      ).toMatchObject({
        title: `Collaborator ${index}`,
        createdById: users[0],
      });
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
});
