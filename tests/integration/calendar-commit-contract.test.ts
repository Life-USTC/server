import { afterAll, beforeAll, expect, it } from "vitest";
import { setCalendarExportRebuildSenderForTest } from "@/features/calendar/server/calendar-export-queue";
import { createHomeworkForSection } from "@/features/homeworks/server/homework-create";
import { appendUserSectionSubscriptions } from "@/features/subscriptions/server/subscription-write-model";
import {
  createTodo,
  deleteOwnedTodo,
} from "@/features/todos/server/todo-service";
import { setYoungEventSubscription } from "@/features/young/server/young-subscription-service";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const userId = crypto.randomUUID();
const youngId = `commit-${crypto.randomUUID()}`;
const triggerName = `calendar_commit_${userId.replaceAll("-", "")}`;
let sectionId: number;

beforeAll(async () => {
  const course = await db.course.findFirstOrThrow({ select: { id: true } });
  sectionId = (
    await db.section.create({
      data: {
        courseId: course.id,
        jwId: -Math.floor(Math.random() * 1e9) - 1,
        code: `COMMIT.${userId}`,
      },
    })
  ).id;
  await db.user.create({
    data: {
      id: userId,
      name: "Calendar commit test",
      email: `${userId}@test.invalid`,
    },
  });
  await db.youngEvent.create({
    data: {
      youngId,
      name: "Calendar commit event",
      isActive: true,
      rawJson: {},
    },
  });
  // A deferred trigger runs when PostgreSQL commits, after the source DML completed.
  await db.$executeRawUnsafe(
    `CREATE FUNCTION "${triggerName}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF COALESCE(to_jsonb(NEW), to_jsonb(OLD))::text LIKE '%' || TG_ARGV[0] || '%' THEN RAISE EXCEPTION 'calendar test rejects commit'; END IF; RETURN NEW; END $$`,
  );
});
afterAll(async () => {
  setCalendarExportRebuildSenderForTest();
  for (const table of [
    "Todo",
    "Homework",
    "UserSectionSubscription",
    "UserYoungEventSubscription",
  ])
    await db.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS "${triggerName}" ON "${table}"`,
    );
  await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${triggerName}"()`);
  await db.auditLog.deleteMany({ where: { userId } });
  if (sectionId) await db.homework.deleteMany({ where: { sectionId } });
  await db.user.deleteMany({ where: { id: userId } });
  if (sectionId) await db.section.delete({ where: { id: sectionId } });
  await db.youngEvent.deleteMany({ where: { youngId } });
  await Promise.all([db.$disconnect(), runtimePrisma.$disconnect()]);
});

it("ical.committed-write-rebuilds", async () => {
  const cases = [
    {
      table: "Todo",
      write: () =>
        createTodo({
          userId,
          title: "Committed todo",
          dueAt: new Date("2027-01-01T00:00:00Z"),
        }),
      count: () => db.todo.count({ where: { userId } }),
      clear: () => db.todo.deleteMany({ where: { userId } }),
      message: { type: "user", userId },
    },
    {
      table: "Homework",
      write: () =>
        createHomeworkForSection(userId, {
          sectionId,
          title: "Committed homework",
          isMajor: false,
          requiresTeam: false,
          submissionDueAt: new Date("2027-01-01T00:00:00Z"),
        }),
      count: () => db.homework.count({ where: { sectionId } }),
      clear: () => db.homework.deleteMany({ where: { sectionId } }),
      message: { type: "section", sectionId },
    },
    {
      table: "UserSectionSubscription",
      write: () =>
        appendUserSectionSubscriptions({ userId, sectionIds: [sectionId] }),
      count: () =>
        db.userSectionSubscription.count({ where: { userId, sectionId } }),
      clear: () =>
        db.userSectionSubscription.deleteMany({ where: { userId, sectionId } }),
      message: { type: "user", userId },
    },
    {
      table: "UserYoungEventSubscription",
      write: () => setYoungEventSubscription(userId, youngId, true),
      count: () =>
        db.userYoungEventSubscription.count({ where: { userId, youngId } }),
      clear: () =>
        db.userYoungEventSubscription.deleteMany({
          where: { userId, youngId },
        }),
      message: { type: "user", userId },
    },
  ];
  for (const scenario of cases) {
    const messages: unknown[] = [];
    const reads: Promise<number>[] = [];
    setCalendarExportRebuildSenderForTest(async (message) => {
      messages.push(message);
      // The elevated fixture client uses a different connection from the runtime transaction.
      reads.push(scenario.count());
    });
    await scenario.write();
    expect(messages).toEqual([scenario.message]);
    expect(await Promise.all(reads)).toEqual([1]);
    await scenario.clear();
    messages.length = 0;
    reads.length = 0;
    await db.$executeRawUnsafe(
      `CREATE CONSTRAINT TRIGGER "${triggerName}" AFTER INSERT OR UPDATE ON "${scenario.table}" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "${triggerName}"('${userId}')`,
    );
    try {
      await expect(scenario.write()).rejects.toThrow();
      expect(await scenario.count()).toBe(0);
      expect(messages).toEqual([]);
      expect(reads).toEqual([]);
    } finally {
      await db.$executeRawUnsafe(
        `DROP TRIGGER "${triggerName}" ON "${scenario.table}"`,
      );
      setCalendarExportRebuildSenderForTest();
    }
  }
});

it("todo.delete-calendar-after-commit", async () => {
  const first = await db.todo.create({
    data: { userId, title: "Delete after commit" },
  });
  const messages: unknown[] = [];
  const reads: Promise<number>[] = [];
  setCalendarExportRebuildSenderForTest(async (message) => {
    messages.push(message);
    reads.push(db.todo.count({ where: { id: first.id } }));
  });
  expect(await deleteOwnedTodo(first.id, userId)).toEqual({ ok: true });
  expect(messages).toEqual([{ type: "user", userId }]);
  expect(await Promise.all(reads)).toEqual([0]);
  const second = await db.todo.create({
    data: { userId, title: "Retain after rollback" },
  });
  messages.length = 0;
  reads.length = 0;
  await db.$executeRawUnsafe(
    `CREATE CONSTRAINT TRIGGER "${triggerName}" AFTER DELETE ON "Todo" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "${triggerName}"('${userId}')`,
  );
  try {
    await expect(deleteOwnedTodo(second.id, userId)).rejects.toThrow();
    expect(
      await db.todo.findUnique({ where: { id: second.id } }),
    ).toMatchObject({ title: "Retain after rollback" });
    expect(messages).toEqual([]);
    expect(reads).toEqual([]);
  } finally {
    await db.$executeRawUnsafe(`DROP TRIGGER "${triggerName}" ON "Todo"`);
    setCalendarExportRebuildSenderForTest();
  }
});
