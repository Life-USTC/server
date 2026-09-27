import { afterAll, beforeAll, expect, it } from "vitest";
import { listUserCalendarEvents } from "@/features/calendar/server/calendar-events";
import { setCalendarExportRebuildSenderForTest } from "@/features/calendar/server/calendar-export-queue";
import {
  createTodo,
  deleteOwnedTodo,
  listTodos,
  updateOwnedTodo,
} from "@/features/todos/server/todo-service";
import { getCompactOverview } from "@/features/workspace/server/compact-overview-read-model";
import { prisma } from "@/lib/db/prisma";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const owners: string[] = [];
const atTime = new Date("2031-01-15T12:00:00+08:00");
async function owner() {
  const id = crypto.randomUUID();
  await db.user.create({
    data: { id, name: "Personal tasks", email: `${id}@test.invalid` },
  });
  owners.push(id);
  return id;
}
const calendar = (userId: string) =>
  listUserCalendarEvents(userId, {
    dateFrom: new Date("2031-01-14T00:00:00+08:00"),
    dateTo: new Date("2031-01-17T00:00:00+08:00"),
  });
beforeAll(() => setCalendarExportRebuildSenderForTest(async () => {}));
afterAll(async () => {
  setCalendarExportRebuildSenderForTest();
  await db.user.deleteMany({ where: { id: { in: owners } } });
  await Promise.all([db.$disconnect(), prisma.$disconnect()]);
});

it("todo.purely-personal", async () => {
  const userId = await owner();
  const title = `Personal-only ${crypto.randomUUID()}`;
  const { id } = await createTodo({ userId, title, dueAt: atTime });
  expect(await db.userSectionSubscription.count({ where: { userId } })).toBe(0);
  expect(await listTodos({ userId })).toMatchObject([{ id, title }]);
  expect(
    await updateOwnedTodo({
      id,
      userId,
      data: {
        title: `${title} edited`,
        content: "Private notes",
        hasDueAt: false,
        dueAt: undefined,
      },
    }),
  ).toMatchObject({ ok: true });
  expect(
    await db.homework.count({ where: { title: { startsWith: title } } }),
  ).toBe(0);
  expect(await calendar(userId)).toMatchObject([
    { type: "todo_due", payload: { id, title: `${title} edited` } },
  ]);
  expect(await deleteOwnedTodo(id, userId)).toEqual({ ok: true });
  expect(await listTodos({ userId })).toEqual([]);
  expect(await db.userSectionSubscription.count({ where: { userId } })).toBe(0);
});

it("todo.due-date-calendar", async () => {
  const userId = await owner();
  const rows = await db.todo.createManyAndReturn({
    data: [
      { userId, title: "Incomplete dated", dueAt: atTime, completed: false },
      { userId, title: "Incomplete undated", dueAt: null, completed: false },
      { userId, title: "Completed dated", dueAt: atTime, completed: true },
      { userId, title: "Completed undated", dueAt: null, completed: true },
    ],
  });
  const dated = rows.find((row) => row.title === "Incomplete dated");
  if (!dated) throw new Error("Missing dated fixture");
  expect(await calendar(userId)).toMatchObject([
    { type: "todo_due", payload: { id: dated.id } },
  ]);
  expect(
    await updateOwnedTodo({
      userId,
      id: dated.id,
      data: { completed: true, hasDueAt: false, dueAt: undefined },
    }),
  ).toMatchObject({ ok: true });
  expect(await calendar(userId)).toEqual([]);
  expect(
    await updateOwnedTodo({
      userId,
      id: dated.id,
      data: { completed: false, hasDueAt: false, dueAt: undefined },
    }),
  ).toMatchObject({ ok: true });
  expect(await calendar(userId)).toHaveLength(1);
  expect(
    await updateOwnedTodo({
      userId,
      id: dated.id,
      data: { dueAt: null, hasDueAt: true },
    }),
  ).toMatchObject({ ok: true });
  expect(await calendar(userId)).toEqual([]);
});

it("todo.completed-retained", async () => {
  const userId = await owner();
  const { id } = await createTodo({
    userId,
    title: "Retained task",
    content: "Original content",
    dueAt: atTime,
    priority: "high",
  });
  const original = await db.todo.findUniqueOrThrow({ where: { id } });
  expect(
    await updateOwnedTodo({
      userId,
      id,
      data: { completed: true, hasDueAt: false, dueAt: undefined },
    }),
  ).toMatchObject({ ok: true });
  const completed = await listTodos({ userId, completed: true });
  expect(completed).toHaveLength(1);
  expect(completed[0]).toMatchObject({
    id,
    title: original.title,
    content: original.content,
    priority: original.priority,
    dueAt: original.dueAt,
    completed: true,
  });
  expect(await listTodos({ userId, completed: false })).toEqual([]);
  expect(await db.todo.findUniqueOrThrow({ where: { id } })).toMatchObject({
    createdAt: original.createdAt,
  });
  expect(
    await updateOwnedTodo({
      userId,
      id,
      data: { completed: false, hasDueAt: false, dueAt: undefined },
    }),
  ).toMatchObject({ ok: true });
  expect(await listTodos({ userId, completed: true })).toEqual([]);
  expect(await listTodos({ userId, completed: false })).toMatchObject([
    { id, completed: false },
  ]);
});

it("todo.completed-not-urgent", async () => {
  const userId = await owner();
  const rows = await db.todo.createManyAndReturn({
    data: [
      {
        userId,
        title: "Old completed",
        completed: true,
        dueAt: new Date("2031-01-14T12:00:00+08:00"),
      },
      {
        userId,
        title: "Upcoming completed",
        completed: true,
        dueAt: new Date("2031-01-16T12:00:00+08:00"),
      },
      {
        userId,
        title: "Upcoming incomplete",
        completed: false,
        dueAt: new Date("2031-01-16T12:00:00+08:00"),
      },
    ],
  });
  const active = rows.find((row) => !row.completed);
  if (!active) throw new Error("Missing active fixture");
  const overview = await getCompactOverview(userId, { atTime });
  expect(overview.counts.todos).toMatchObject({
    incomplete: 1,
    completed: 2,
    overdue: 0,
  });
  expect(overview.dueTodos.total).toBe(1);
  expect(overview.dueTodos.items.map((row) => row.id)).toEqual([active.id]);
  expect(await calendar(userId)).toMatchObject([
    { type: "todo_due", payload: { id: active.id } },
  ]);
  expect(
    await updateOwnedTodo({
      userId,
      id: active.id,
      data: { completed: true, hasDueAt: false, dueAt: undefined },
    }),
  ).toMatchObject({ ok: true });
  const after = await getCompactOverview(userId, { atTime });
  expect(after.counts.todos).toMatchObject({
    incomplete: 0,
    completed: 3,
    overdue: 0,
  });
  expect(after.dueTodos).toEqual({ total: 0, items: [] });
  expect(await calendar(userId)).toEqual([]);
});
