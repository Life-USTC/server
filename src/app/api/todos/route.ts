import type { Prisma } from "@/generated/prisma/client";
import {
  badRequest,
  handleRouteError,
  jsonResponse,
  parseRouteJsonBody,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import {
  todoCreateRequestSchema,
  todosQuerySchema,
} from "@/lib/api/schemas/request-schemas";
import { requireAuth } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { observedApiRoute } from "@/lib/log/api-observability";
import { parseDateInput } from "@/lib/time/parse-date-input";

export const dynamic = "force-dynamic";

/**
 * List todos for the current user.
 * @params todosQuerySchema
 * @response todosListResponseSchema
 * @response 401:openApiErrorSchema
 */
async function getRoute(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const { searchParams } = new URL(request.url);
  const parsedQuery = parseRouteSearchParams(
    searchParams,
    todosQuerySchema,
    "Invalid todo query",
    { logErrors: true },
  );
  if (parsedQuery instanceof Response) {
    return parsedQuery;
  }

  const where: Prisma.TodoWhereInput = { userId };
  if (parsedQuery.completed === "true") where.completed = true;
  else if (parsedQuery.completed === "false") where.completed = false;
  if (parsedQuery.priority) where.priority = parsedQuery.priority;
  if (parsedQuery.dueBefore || parsedQuery.dueAfter) {
    const dueAtFilter: Prisma.TodoWhereInput["dueAt"] = {};
    if (parsedQuery.dueBefore) {
      const parsed = parseDateInput(parsedQuery.dueBefore);
      if (parsed) dueAtFilter.lt = parsed;
    }
    if (parsedQuery.dueAfter) {
      const parsed = parseDateInput(parsedQuery.dueAfter);
      if (parsed) dueAtFilter.gte = parsed;
    }
    where.dueAt = dueAtFilter;
  }

  try {
    const todos = await prisma.todo.findMany({
      where,
      orderBy: [{ completed: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
    });

    return jsonResponse({ todos });
  } catch (error) {
    return handleRouteError("Failed to fetch todos", error);
  }
}
export const GET = observedApiRoute(getRoute);

/**
 * Create a todo for the current user.
 * @body todoCreateRequestSchema
 * @response idResponseSchema
 * @response 400:openApiErrorSchema
 */
async function postRoute(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const parsedBody = await parseRouteJsonBody(
    request,
    todoCreateRequestSchema,
    "Invalid todo request",
  );
  if (parsedBody instanceof Response) {
    return parsedBody;
  }

  const dueAtRaw = parsedBody.dueAt;
  let dueAt: Date | null | undefined;
  if (dueAtRaw !== undefined) {
    dueAt = parseDateInput(dueAtRaw);
    if (dueAt === undefined) {
      return badRequest("Invalid due date");
    }
  }

  try {
    const todo = await prisma.todo.create({
      data: {
        userId,
        title: parsedBody.title,
        content: parsedBody.content?.trim() || null,
        priority: parsedBody.priority ?? "medium",
        ...(dueAt !== undefined && { dueAt }),
      },
    });

    return jsonResponse({ id: todo.id });
  } catch (error) {
    return handleRouteError("Failed to create todo", error);
  }
}
export const POST = observedApiRoute(postRoute);
