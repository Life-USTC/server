import { expect } from "vitest";
import { createHomeworkForSection } from "@/features/homeworks/server/homework-create";
import { appendUserSectionSubscriptions } from "@/features/subscriptions/server/subscription-write-model";
import {
  createTodo,
  deleteOwnedTodo,
} from "@/features/todos/server/todo-service";
import { setYoungEventSubscription } from "@/features/young/server/young-subscription-service";
import {
  type CalendarCommitState,
  test,
} from "../shared/calendar-commit-fixture";

function sourceWrites({ db, userId, sectionId, youngId }: CalendarCommitState) {
  return {
    Todo: {
      write: () =>
        createTodo({
          userId,
          title: "Committed todo",
          dueAt: new Date("2027-01-01T00:00:00Z"),
        }),
      count: () => db.todo.count({ where: { userId } }),
      message: { type: "user", userId },
    },
    Homework: {
      write: () =>
        createHomeworkForSection(userId, {
          sectionId,
          title: "Committed homework",
          isMajor: false,
          requiresTeam: false,
          submissionDueAt: new Date("2027-01-01T00:00:00Z"),
        }),
      count: () => db.homework.count({ where: { sectionId } }),
      message: { type: "section", sectionId },
    },
    UserSectionSubscription: {
      write: () =>
        appendUserSectionSubscriptions({ userId, sectionIds: [sectionId] }),
      count: () =>
        db.userSectionSubscription.count({ where: { userId, sectionId } }),
      message: { type: "user", userId },
    },
    UserYoungEventSubscription: {
      write: () => setYoungEventSubscription(userId, youngId, true),
      count: () =>
        db.userYoungEventSubscription.count({ where: { userId, youngId } }),
      message: { type: "user", userId },
    },
  };
}

async function rejectCommit(
  db: CalendarCommitState["db"],
  table: keyof ReturnType<typeof sourceWrites>,
  event: "INSERT OR UPDATE" | "DELETE" = "INSERT OR UPDATE",
) {
  // This database belongs to this case. A deferred constraint rejects the actual
  // commit, after the source DML and before a rebuild may be requested.
  await db.$executeRawUnsafe(
    `CREATE FUNCTION calendar_reject_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'calendar test rejects commit'; END $$`,
  );
  await db.$executeRawUnsafe(
    `CREATE CONSTRAINT TRIGGER calendar_reject_commit AFTER ${event} ON "${table}" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION calendar_reject_commit()`,
  );
}

for (const table of [
  "Todo",
  "Homework",
  "UserSectionSubscription",
  "UserYoungEventSubscription",
] as const) {
  test(
    `${table} rebuild observes the committed source row`,
    { tags: ["@Calendar/Service"] },
    async ({ calendar }) =>
      calendar.workflow(async () => {
        const source = sourceWrites(calendar)[table];
        const visibleRows: number[] = [];
        await calendar.run(
          async () => source.write(),
          async () => {
            // The fixture client is a separate connection from the application write.
            visibleRows.push(await source.count());
          },
        );
        expect(calendar.messages).toEqual([source.message]);
        expect(visibleRows).toEqual([1]);
        expect(await source.count()).toBe(1);
      }),
  );

  test(
    `${table} rejected commit leaves no row or rebuild`,
    { tags: ["@Calendar/Service"] },
    async ({ calendar }) =>
      calendar.workflow(async () => {
        const source = sourceWrites(calendar)[table];
        await rejectCommit(calendar.db, table);
        await expect(calendar.run(async () => source.write())).rejects.toThrow(
          "calendar test rejects commit",
        );
        expect(await source.count()).toBe(0);
        expect(calendar.messages).toEqual([]);
        expect(await calendar.db.auditLog.count()).toBe(0);
      }),
  );
}

test(
  "todo deletion rebuild observes the committed absence",
  { tags: ["@Calendar/Service"] },
  async ({ calendar }) =>
    calendar.workflow(async () => {
      const { db, userId, messages } = calendar;
      const todo = await db.todo.create({
        data: { userId, title: "Delete after commit" },
      });
      const visibleRows: number[] = [];
      const result = await calendar.run(
        () => deleteOwnedTodo(todo.id, userId),
        async () => {
          visibleRows.push(await db.todo.count({ where: { id: todo.id } }));
        },
      );
      expect(result).toEqual({ ok: true });
      expect(messages).toEqual([{ type: "user", userId }]);
      expect(visibleRows).toEqual([0]);
      expect(await db.todo.findUnique({ where: { id: todo.id } })).toBeNull();
    }),
);

test(
  "todo rejected deletion preserves the row without a rebuild",
  { tags: ["@Calendar/Service"] },
  async ({ calendar }) =>
    calendar.workflow(async () => {
      const { db, userId } = calendar;
      const todo = await db.todo.create({
        data: { userId, title: "Retain after rollback" },
      });
      await rejectCommit(db, "Todo", "DELETE");
      await expect(
        calendar.run(() => deleteOwnedTodo(todo.id, userId)),
      ).rejects.toThrow("calendar test rejects commit");
      expect(await db.todo.findUnique({ where: { id: todo.id } })).toEqual(
        todo,
      );
      expect(calendar.messages).toEqual([]);
      expect(await db.auditLog.count()).toBe(0);
    }),
);
