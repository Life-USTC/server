import type { TodoPriorityValue } from "@/features/todos/lib/todo-priority";
import {
  createTodo,
  deleteOwnedTodo,
  listTodoSummary,
  type TodoListFilters,
  updateOwnedTodo,
} from "@/features/todos/server/todo-service";
import {
  badRequest,
  createdJsonResponse,
  forbidden,
  jsonResponse,
  notFound,
} from "@/lib/api/helpers";

export async function listTodosAction(
  userId: string,
  filters: TodoListFilters,
  take?: number,
) {
  return jsonResponse(await listTodoSummary({ userId, take, filters }));
}

export async function createTodoAction(
  userId: string,
  parsedBody: {
    content?: string | null;
    priority?: TodoPriorityValue;
    title: string;
  },
  dueAt: Date | null | undefined,
) {
  const todo = await createTodo({
    userId,
    title: parsedBody.title,
    content: parsedBody.content,
    priority: parsedBody.priority,
    dueAt,
  });

  return createdJsonResponse(
    { id: todo.id },
    `/api/todos/${encodeURIComponent(todo.id)}`,
  );
}

export async function updateTodoAction(
  id: string,
  userId: string,
  parsedBody: {
    completed?: boolean;
    content?: string | null;
    priority?: TodoPriorityValue;
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
      priority: parsedBody.priority,
      title: parsedBody.title,
    },
  });

  if (!result.ok) {
    if (result.error === "not_found") return notFound();
    if (result.error === "forbidden") return forbidden();
    return badRequest("No changes");
  }

  return jsonResponse({ success: true, todo: result.todo });
}

export async function deleteTodoAction(id: string, userId: string) {
  const result = await deleteOwnedTodo(id, userId);
  if (!result.ok) {
    if (result.error === "not_found") return notFound();
    return forbidden();
  }

  return jsonResponse({ success: true });
}
