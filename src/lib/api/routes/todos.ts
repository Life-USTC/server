import { readDemoTodos } from "@/features/demo/server/demo-todos";
import type { AppLocale } from "@/i18n/config";
import {
  badRequest,
  handleRouteError,
  parseRouteInput,
  parseRouteJsonBody,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import { privateSessionJson } from "@/lib/api/internal-session-response";
import {
  createTodoAction,
  deleteTodoAction,
  listTodoPageAction,
  listTodosAction,
  updateTodoAction,
} from "@/lib/api/routes/todo-actions";
import {
  resourceIdPathParamsSchema,
  todoCreateRequestSchema,
  todosQuerySchema,
  todoUpdateRequestSchema,
} from "@/lib/api/schemas/request-schemas";
import { requireAuth } from "@/lib/auth/api-auth";
import { parseDateInput } from "@/lib/time/parse-date-input";

export function getDemoTodosRoute(request: Request, locale: AppLocale) {
  const query = parseTodosQuery(request);
  if (query instanceof Response) return query;
  const { limit, page, pageSize, ...filters } = query;
  return privateSessionJson(
    readDemoTodos({ locale, filters, limit, page, pageSize }),
  );
}

export type TodoIdParams = { id: string };

export function parseTodoIdParams(params: TodoIdParams) {
  const parsedParams = parseRouteInput(
    params,
    resourceIdPathParamsSchema,
    "Invalid todo ID",
  );
  if (parsedParams instanceof Response) {
    return parsedParams;
  }
  return parsedParams.id;
}

export function parseTodosQuery(request: Request) {
  const { searchParams } = new URL(request.url);
  return parseRouteSearchParams(
    searchParams,
    todosQuerySchema,
    "Invalid todo query",
    { logErrors: true },
  );
}

export function parseTodoCreateBody(request: Request) {
  return parseRouteJsonBody(
    request,
    todoCreateRequestSchema,
    "Invalid todo request",
  );
}

export function parseTodoUpdateBody(request: Request) {
  return parseRouteJsonBody(
    request,
    todoUpdateRequestSchema,
    "Invalid todo update",
  );
}

export function parseTodoDueAt(dueAtRaw: unknown) {
  if (dueAtRaw === undefined) return { ok: true as const, dueAt: undefined };
  const dueAt = parseDateInput(dueAtRaw);
  if (dueAt === undefined) {
    return { ok: false as const, response: badRequest("Invalid due date") };
  }
  return { ok: true as const, dueAt };
}

export async function getTodosRoute(request: Request) {
  const auth = await requireAuth(request, {
    bearerScope: { feature: "workspace.todo", action: "read" },
  });
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const parsedQuery = parseTodosQuery(request);
  if (parsedQuery instanceof Response) {
    return parsedQuery;
  }
  const { limit, page, pageSize, ...filters } = parsedQuery;

  try {
    if (page !== undefined || pageSize !== undefined) {
      return await listTodoPageAction(userId, filters, {
        page: page ?? 1,
        pageSize: pageSize ?? 20,
      });
    }
    return await listTodosAction(userId, filters, limit);
  } catch (error) {
    return handleRouteError("Failed to fetch todos", error);
  }
}

export async function postTodoRoute(request: Request) {
  const auth = await requireAuth(request, {
    bearerScope: { feature: "workspace.todo", action: "write" },
  });
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

export async function patchTodoRoute(request: Request, params: TodoIdParams) {
  const id = parseTodoIdParams(params);
  if (id instanceof Response) return id;

  const auth = await requireAuth(request, {
    bearerScope: { feature: "workspace.todo", action: "write" },
  });
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

export async function deleteTodoRoute(request: Request, params: TodoIdParams) {
  const id = parseTodoIdParams(params);
  if (id instanceof Response) return id;

  const auth = await requireAuth(request, {
    bearerScope: { feature: "workspace.todo", action: "write" },
  });
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  try {
    return await deleteTodoAction(id, userId);
  } catch (error) {
    return handleRouteError("Failed to delete todo", error);
  }
}
