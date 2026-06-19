import {
  createTodo,
  deleteOwnedTodo,
  listTodos,
  updateOwnedTodo,
} from "@/features/todos/server/todo-service";
import type { Prisma, TodoPriority } from "@/generated/prisma/client";
import {
  badRequest,
  forbidden,
  jsonResponse,
  notFound,
} from "@/lib/api/helpers";

export async function listTodosAction(where: Prisma.TodoWhereInput) {
  const todos = await listTodos(where);
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
  const todo = await createTodo({
    userId,
    title: parsedBody.title,
    content: parsedBody.content,
    priority: parsedBody.priority as TodoPriority | undefined,
    dueAt,
  });

  return jsonResponse({ id: todo.id });
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
  const result = await updateOwnedTodo({
    id,
    userId,
    data: {
      completed: parsedBody.completed,
      content: parsedBody.content,
      dueAt,
      hasContent: Object.hasOwn(parsedBody, "content"),
      hasDueAt,
      priority: parsedBody.priority as TodoPriority | undefined,
      title: parsedBody.title,
    },
  });

  if (!result.ok) {
    if (result.error === "not_found") return notFound();
    if (result.error === "forbidden") return forbidden();
    return badRequest("No changes");
  }

  return jsonResponse({ success: true });
}

export async function deleteTodoAction(id: string, userId: string) {
  const result = await deleteOwnedTodo(id, userId);
  if (!result.ok) {
    if (result.error === "not_found") return notFound();
    return forbidden();
  }

  return jsonResponse({ success: true });
}
