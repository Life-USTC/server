import type { Prisma, TodoPriority } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export const todoSnapshotSelect = {
  id: true,
  title: true,
  content: true,
  priority: true,
  dueAt: true,
  completed: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.TodoSelect;

const todoListOrderBy = [
  { completed: "asc" },
  { dueAt: "asc" },
  { createdAt: "desc" },
] as const satisfies Prisma.TodoOrderByWithRelationInput[];

type TodoMutationDataInput = {
  completed?: boolean;
  content?: string | null;
  dueAt: Date | null | undefined;
  hasContent?: boolean;
  hasDueAt: boolean;
  priority?: TodoPriority;
  title?: string;
};

type TodoCreateInput = {
  content?: string | null;
  dueAt?: Date | null;
  priority?: TodoPriority;
  title: string;
  userId: string;
};

export function buildTodoMutationData(input: TodoMutationDataInput) {
  const updates: Prisma.TodoUpdateInput = {};
  if (input.title !== undefined) updates.title = input.title;
  if (input.hasContent ?? input.content !== undefined) {
    updates.content = input.content?.trim() || null;
  }
  if (input.priority !== undefined) updates.priority = input.priority;
  if (input.hasDueAt) updates.dueAt = input.dueAt;
  if (input.completed !== undefined) updates.completed = input.completed;
  return updates;
}

export async function createTodo(input: TodoCreateInput) {
  return prisma.todo.create({
    select: { id: true },
    data: {
      userId: input.userId,
      title: input.title,
      content: input.content?.trim() || null,
      priority: input.priority ?? "medium",
      ...(input.dueAt !== undefined && { dueAt: input.dueAt }),
    },
  });
}

export async function listTodos(where: Prisma.TodoWhereInput) {
  return prisma.todo.findMany({
    where,
    select: todoSnapshotSelect,
    orderBy: todoListOrderBy,
  });
}

export async function listTodoSummary(input: {
  now?: Date;
  take?: number;
  userId: string;
  where: Prisma.TodoWhereInput;
}) {
  const now = input.now ?? new Date();
  const [incompleteCount, completedCount, overdueCount, todos] =
    await Promise.all([
      prisma.todo.count({
        where: { userId: input.userId, completed: false },
      }),
      prisma.todo.count({
        where: { userId: input.userId, completed: true },
      }),
      prisma.todo.count({
        where: {
          userId: input.userId,
          completed: false,
          dueAt: { lt: now },
        },
      }),
      prisma.todo.findMany({
        where: input.where,
        select: todoSnapshotSelect,
        orderBy: todoListOrderBy,
        ...(input.take !== undefined && { take: input.take }),
      }),
    ]);

  return {
    counts: {
      incomplete: incompleteCount,
      completed: completedCount,
      overdue: overdueCount,
    },
    todos,
  };
}

export async function requireOwnedTodo(id: string, userId: string) {
  const todo = await prisma.todo.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });

  if (!todo) return { ok: false as const, error: "not_found" as const };
  if (todo.userId !== userId) {
    return { ok: false as const, error: "forbidden" as const };
  }
  return { ok: true as const, todo };
}

export async function updateOwnedTodo(input: {
  data: TodoMutationDataInput;
  id: string;
  userId: string;
}) {
  const ownership = await requireOwnedTodo(input.id, input.userId);
  if (!ownership.ok) return ownership;

  const updates = buildTodoMutationData(input.data);
  if (Object.keys(updates).length === 0) {
    return { ok: false as const, error: "no_changes" as const };
  }

  await prisma.todo.update({ where: { id: input.id }, data: updates });
  return { ok: true as const };
}

export async function deleteOwnedTodo(id: string, userId: string) {
  const ownership = await requireOwnedTodo(id, userId);
  if (!ownership.ok) return ownership;

  await prisma.todo.delete({ where: { id } });
  return { ok: true as const };
}

export async function getTodoSnapshot(id: string) {
  return prisma.todo.findUnique({
    where: { id },
    select: todoSnapshotSelect,
  });
}
