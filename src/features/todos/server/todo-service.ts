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

export const todoDueSampleSelect = {
  id: true,
  title: true,
  priority: true,
  dueAt: true,
  createdAt: true,
} as const satisfies Prisma.TodoSelect;

export const todoListOrderBy = [
  { completed: "asc" },
  { dueAt: "asc" },
  { createdAt: "desc" },
] satisfies Prisma.TodoOrderByWithRelationInput[];

export const todoDueDateOrderBy = [
  { dueAt: "asc" },
  { createdAt: "desc" },
] satisfies Prisma.TodoOrderByWithRelationInput[];

export type TodoSnapshot = Prisma.TodoGetPayload<{
  select: typeof todoSnapshotSelect;
}>;

export type TodoDueSample = Prisma.TodoGetPayload<{
  select: typeof todoDueSampleSelect;
}>;

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

export type TodoListFilters = {
  completed?: boolean;
  dueAfter?: Date;
  dueBefore?: Date;
  priority?: TodoPriority;
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
  return listTodoSnapshots({ where });
}

function buildTodoListWhere(userId: string, filters?: TodoListFilters) {
  const where: Prisma.TodoWhereInput = { userId };
  if (!filters) return where;

  if (filters.completed !== undefined) where.completed = filters.completed;
  if (filters.priority) where.priority = filters.priority;
  if (filters.dueBefore || filters.dueAfter) {
    where.dueAt = {
      ...(filters.dueBefore ? { lt: filters.dueBefore } : {}),
      ...(filters.dueAfter ? { gte: filters.dueAfter } : {}),
    };
  }

  return where;
}

export async function listTodoSnapshots(input: {
  orderBy?: Prisma.TodoOrderByWithRelationInput[];
  take?: number;
  where: Prisma.TodoWhereInput;
}) {
  return prisma.todo.findMany({
    where: input.where,
    select: todoSnapshotSelect,
    orderBy: input.orderBy ?? todoListOrderBy,
    ...(input.take !== undefined && { take: input.take }),
  });
}

export async function listDueTodoSnapshots(input: {
  completed?: boolean;
  dueAtFrom?: Date;
  dueAtTo?: Date;
  includeDueAtTo?: boolean;
  take?: number;
  userId: string;
}) {
  return listTodoSnapshots({
    orderBy: todoDueDateOrderBy,
    take: input.take,
    where: buildDueTodoWhere(input),
  });
}

export async function listDueTodoSamples(input: {
  completed?: boolean;
  dueAtFrom?: Date;
  dueAtTo?: Date;
  includeDueAtTo?: boolean;
  take?: number;
  userId: string;
}) {
  return prisma.todo.findMany({
    where: buildDueTodoWhere(input),
    select: todoDueSampleSelect,
    orderBy: todoDueDateOrderBy,
    ...(input.take !== undefined && { take: input.take }),
  });
}

export async function countIncompleteTodos(userId: string) {
  return prisma.todo.count({
    where: { userId, completed: false },
  });
}

export async function countDueTodos(input: {
  completed?: boolean;
  dueAtFrom?: Date;
  dueAtTo?: Date;
  includeDueAtTo?: boolean;
  userId: string;
}) {
  return prisma.todo.count({
    where: buildDueTodoWhere(input),
  });
}

function buildDueTodoWhere(input: {
  completed?: boolean;
  dueAtFrom?: Date;
  dueAtTo?: Date;
  includeDueAtTo?: boolean;
  userId: string;
}) {
  const dueAt: Prisma.DateTimeNullableFilter = { not: null };
  if (input.dueAtFrom) dueAt.gte = input.dueAtFrom;
  if (input.dueAtTo) {
    if (input.includeDueAtTo) {
      dueAt.lte = input.dueAtTo;
    } else {
      dueAt.lt = input.dueAtTo;
    }
  }

  const where: Prisma.TodoWhereInput = {
    userId: input.userId,
    dueAt,
  };
  if (input.completed !== undefined) where.completed = input.completed;
  return where;
}

export async function listTodoSummary(input: {
  filters?: TodoListFilters;
  now?: Date;
  take?: number;
  userId: string;
}) {
  const now = input.now ?? new Date();
  const where = buildTodoListWhere(input.userId, input.filters);
  const [incompleteCount, completedCount, overdueCount, todos] =
    await Promise.all([
      countIncompleteTodos(input.userId),
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
      listTodoSnapshots({
        where,
        take: input.take,
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

  const todo = await prisma.todo.update({
    where: { id: input.id },
    data: updates,
    select: todoSnapshotSelect,
  });
  return { ok: true as const, todo };
}

export async function deleteOwnedTodo(id: string, userId: string) {
  const ownership = await requireOwnedTodo(id, userId);
  if (!ownership.ok) return ownership;

  await prisma.todo.delete({ where: { id } });
  return { ok: true as const };
}
