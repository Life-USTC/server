import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  countDueTodos,
  countIncompleteTodos,
  countOverviewTodoBundleInTransaction,
  listTodoSummary,
} from "@/features/todos/server/todo-service";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import { createFixturePrisma } from "../shared/prisma";

const fixturePrisma = createFixturePrisma();

describe("overview todo bundle counts", () => {
  let userId = "";
  const createdTodoIds: string[] = [];
  const now = new Date("2026-04-29T08:00:00+08:00");
  const homeworkWindowEnd = new Date("2026-05-06T08:00:00+08:00");

  beforeAll(async () => {
    const marker = crypto.randomUUID();
    const user = await fixturePrisma.user.create({
      data: {
        email: `todo-overview-counts-${marker}@example.test`,
        name: "[integration-test] Todo Overview Counts",
      },
      select: { id: true },
    });
    userId = user.id;

    const todos = await fixturePrisma.todo.createManyAndReturn({
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
      select: { id: true },
    });
    createdTodoIds.push(...todos.map((todo) => todo.id));
  });

  afterAll(async () => {
    if (userId) {
      await fixturePrisma.todo.deleteMany({
        where: { id: { in: createdTodoIds } },
      });
      await fixturePrisma.user.deleteMany({ where: { id: userId } });
    }
    await Promise.all([
      fixturePrisma.$disconnect(),
      runtimePrisma.$disconnect(),
    ]);
  });

  it("matches the existing per-count helpers and preserves dueAt IS NOT NULL semantics", async () => {
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

  it("keeps complete summary counts independent from the bounded list filters", async () => {
    const summary = await listTodoSummary({
      filters: { completed: true },
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
    expect(summary.todos[0]?.completed).toBe(true);
  });
});
