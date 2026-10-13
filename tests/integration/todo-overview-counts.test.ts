import { describe } from "vitest";
import {
  countDueTodos,
  countIncompleteTodos,
  countOverviewTodoBundleInTransaction,
  listTodoSummary,
} from "@/features/todos/server/todo-service";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import { isolatedNodeTest } from "../shared/isolated-node-fixture";

const now = new Date("2026-04-29T08:00:00+08:00");
const homeworkWindowEnd = new Date("2026-05-06T08:00:00+08:00");
const test = isolatedNodeTest.extend("userId", async ({ isolatedDatabase }) => {
  return isolatedDatabase.owner.$transaction(async (db) => {
    const userId = "todo-overview-owner";
    await db.user.create({
      data: {
        id: userId,
        email: "todo-overview-owner@example.test",
        name: "[integration-test] Todo Overview Counts",
      },
    });
    await db.todo.createMany({
      data: [
        {
          userId,
          title: "[integration-test] completed",
          completed: true,
          dueAt: new Date("2026-04-20T08:00:00+08:00"),
        },
        {
          userId,
          title: "[integration-test] incomplete no due date",
          completed: false,
          dueAt: null,
        },
        {
          userId,
          title: "[integration-test] overdue",
          completed: false,
          dueAt: new Date("2026-04-28T08:00:00+08:00"),
        },
        {
          userId,
          title: "[integration-test] due soon",
          completed: false,
          dueAt: new Date("2026-05-01T08:00:00+08:00"),
        },
        {
          userId,
          title: "[integration-test] due later",
          completed: false,
          dueAt: new Date("2026-05-20T08:00:00+08:00"),
        },
      ],
    });
    return userId;
  });
});

describe("overview todo bundle counts", () => {
  test("matches the existing per-count helpers and preserves dueAt IS NOT NULL semantics", {
    tags: ["@Todo/Service"],
  }, async ({ userId, isolatedDatabase, nodeRuntime, expect }) => {
    await nodeRuntime.run(async () => {
      const fixturePrisma = isolatedDatabase.owner;
      const fusedCounts = await runtimePrisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
        return countOverviewTodoBundleInTransaction(tx, {
          userId,
          now,
          homeworkWindowEnd,
        });
      });

      const [incomplete, completed, overdue, dueSoon] = await Promise.all([
        countIncompleteTodos(userId),
        fixturePrisma.todo.count({
          where: { userId, completed: true },
        }),
        fixturePrisma.todo.count({
          where: {
            userId,
            completed: false,
            dueAt: { lt: now },
          },
        }),
        countDueTodos({
          userId,
          completed: false,
          dueAtFrom: now,
          dueAtTo: homeworkWindowEnd,
          includeDueAtTo: true,
        }),
      ]);

      expect(fusedCounts).toEqual({
        incomplete: 4,
        completed: 1,
        overdue: 1,
        dueSoon: 1,
      });
      expect(fusedCounts.incomplete).toBe(incomplete);
      expect(fusedCounts.completed).toBe(completed);
      expect(fusedCounts.overdue).toBe(overdue);
      expect(fusedCounts.dueSoon).toBe(dueSoon);
    });
  });

  test("keeps summary filters, timestamp boundaries and concurrent owners isolated", {
    tags: ["@Todo/Service"],
  }, async ({
    userId,
    isolatedDatabase: { owner: db },
    nodeRuntime,
    expect,
  }) => {
    await nodeRuntime.run(async () => {
      await db.user.create({
        data: { id: "other-owner", email: "other-owner@example.test" },
      });
      const dueAt = new Date("2026-04-30T12:34:56.789Z");
      const createdAt = new Date("2026-04-28T01:02:03.456Z");
      await db.todo.createMany({
        data: [
          {
            id: "tie-a",
            userId,
            title: "A",
            priority: "high",
            dueAt,
            createdAt,
            updatedAt: createdAt,
          },
          {
            id: "tie-b",
            userId,
            title: "B",
            priority: "high",
            dueAt,
            createdAt,
            updatedAt: createdAt,
          },
          {
            id: "other-todo",
            userId: "other-owner",
            title: "private",
            priority: "high",
            dueAt,
          },
        ],
      });
      const summaries = await Promise.all(
        Array.from({ length: 8 }, (_, index) =>
          listTodoSummary({
            userId: index % 2 ? "other-owner" : userId,
            now,
            filters: {
              priority: "high",
              completed: false,
              dueAfter: dueAt,
              dueBefore: new Date(dueAt.getTime() + 1),
            },
          }),
        ),
      );
      summaries.forEach((summary, index) => {
        expect(summary.todos.map((todo) => todo.id)).toEqual(
          index % 2 ? ["other-todo"] : ["tie-a", "tie-b"],
        );
        expect(summary.counts).toEqual(
          index % 2
            ? { incomplete: 1, completed: 0, overdue: 0 }
            : { incomplete: 6, completed: 1, overdue: 1 },
        );
        expect(summary.todos[0].dueAt).toEqual(dueAt);
        if (index % 2 === 0) {
          expect(summary.todos[0].createdAt).toEqual(createdAt);
          expect(summary.todos[0].updatedAt).toEqual(createdAt);
          expect(summary.todos[0].content).toBeNull();
        }
      });
      expect(
        (
          await listTodoSummary({
            userId,
            now,
            filters: { priority: "high", dueBefore: dueAt },
          })
        ).todos,
      ).toEqual([]);
      await db.todo.update({
        where: { id: "tie-a" },
        data: { completed: true },
      });
      expect(
        (
          await listTodoSummary({
            userId,
            now,
            filters: { priority: "high", completed: false },
          })
        ).todos.map((todo) => todo.id),
      ).toEqual(["tie-b"]);
      expect((await listTodoSummary({ userId, now, take: 0 })).todos).toEqual(
        [],
      );
    });
  });

  test("todo.bounded-summary-read", { tags: ["@Todo/Service"] }, async ({
    userId,
    nodeRuntime,
    expect,
  }) => {
    await nodeRuntime.run(async () => {
      for (const completed of [undefined, true, false]) {
        const summary = await listTodoSummary({
          filters: { completed },
          now,
          take: 1,
          userId,
        });

        expect(summary.counts).toEqual({
          incomplete: 4,
          completed: 1,
          overdue: 1,
        });
        expect(summary.todos).toHaveLength(1);
        if (completed !== undefined)
          expect(summary.todos[0]?.completed).toBe(completed);
      }
    });
  });
});
