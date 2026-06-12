import { handleRouteError } from "@/lib/api/helpers";
import {
  buildTodoWhere,
  createTodoAction,
  deleteTodoAction,
  listTodosAction,
  parseTodoDueAt,
  updateTodoAction,
} from "@/lib/api/routes/todo-route-actions";
import {
  type TodoIdParams as IdParams,
  parseTodoIdParams,
} from "@/lib/api/routes/todo-route-parsing";
import {
  parseTodoCreateBody,
  parseTodosQuery,
  parseTodoUpdateBody,
} from "@/lib/api/routes/todo-route-request";
import { requireAuth } from "@/lib/auth/api-auth";

export async function getTodosRoute(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const parsedQuery = parseTodosQuery(request);
  if (parsedQuery instanceof Response) {
    return parsedQuery;
  }

  try {
    return await listTodosAction(buildTodoWhere(userId, parsedQuery));
  } catch (error) {
    return handleRouteError("Failed to fetch todos", error);
  }
}

export async function postTodoRoute(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const parsedBody = await parseTodoCreateBody(request);
  if (parsedBody instanceof Response) {
    return parsedBody;
  }

  const parsedDueAt = parseTodoDueAt(parsedBody.dueAt);
  if (!parsedDueAt.ok) return parsedDueAt.response;

  try {
    return await createTodoAction(userId, parsedBody, parsedDueAt.dueAt);
  } catch (error) {
    return handleRouteError("Failed to create todo", error);
  }
}

export async function patchTodoRoute(request: Request, params: IdParams) {
  const id = parseTodoIdParams(params);
  if (id instanceof Response) return id;

  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const parsedBody = await parseTodoUpdateBody(request);
  if (parsedBody instanceof Response) {
    return parsedBody;
  }

  const hasDueAt = Object.hasOwn(parsedBody, "dueAt");
  const parsedDueAt = parseTodoDueAt(hasDueAt ? parsedBody.dueAt : undefined);
  if (!parsedDueAt.ok) return parsedDueAt.response;

  try {
    return await updateTodoAction(
      id,
      userId,
      parsedBody,
      parsedDueAt.dueAt,
      hasDueAt,
    );
  } catch (error) {
    return handleRouteError("Failed to update todo", error);
  }
}

export async function deleteTodoRoute(request: Request, params: IdParams) {
  const id = parseTodoIdParams(params);
  if (id instanceof Response) return id;

  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  try {
    return await deleteTodoAction(id, userId);
  } catch (error) {
    return handleRouteError("Failed to delete todo", error);
  }
}
