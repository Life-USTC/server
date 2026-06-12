import type { Prisma, TodoPriority } from "@/generated/prisma/client";
import {
  badRequest,
  forbidden,
  jsonResponse,
  notFound,
} from "@/lib/api/helpers";
import { buildTodoUpdateData } from "./todo-update-data";

export async function listTodosAction(where: Prisma.TodoWhereInput) {
  const { prisma } = await import("@/lib/db/prisma");
  const todos = await prisma.todo.findMany({
    where,
    orderBy: [{ completed: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
  });

  return jsonResponse({ todos });
}

export async function createTodoAction(
  userId: string,
  parsedBody: {
    content?: string | null;
    priority?: string;
    title: string;
  },
  dueAt: Date | null | undefined,
) {
  const { prisma } = await import("@/lib/db/prisma");
  const todo = await prisma.todo.create({
    data: {
      userId,
      title: parsedBody.title,
      content: parsedBody.content?.trim() || null,
      priority: (parsedBody.priority ?? "medium") as TodoPriority,
      ...(dueAt !== undefined && { dueAt }),
    },
  });

  return jsonResponse({ id: todo.id });
}

async function requireOwnedTodo(id: string, userId: string) {
  const { prisma } = await import("@/lib/db/prisma");
  const todo = await prisma.todo.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });

  if (!todo) return { prisma, response: notFound() };
  if (todo.userId !== userId) return { prisma, response: forbidden() };
  return { prisma, response: null };
}

export async function updateTodoAction(
  id: string,
  userId: string,
  parsedBody: {
    completed?: boolean;
    content?: string | null;
    priority?: string;
    title?: string;
  },
  dueAt: Date | null | undefined,
  hasDueAt: boolean,
) {
  const { prisma, response } = await requireOwnedTodo(id, userId);
  if (response) return response;

  const updates = buildTodoUpdateData(parsedBody, dueAt, hasDueAt);

  if (Object.keys(updates).length === 0) {
    return badRequest("No changes");
  }

  await prisma.todo.update({ where: { id }, data: updates });

  return jsonResponse({ success: true });
}

export async function deleteTodoAction(id: string, userId: string) {
  const { prisma, response } = await requireOwnedTodo(id, userId);
  if (response) return response;

  await prisma.todo.delete({ where: { id } });

  return jsonResponse({ success: true });
}
