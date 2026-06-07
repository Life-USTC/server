import type { Prisma } from "@/generated/prisma/client";
import {
  badRequest,
  forbidden,
  handleRouteError,
  jsonResponse,
  notFound,
  parseResourceIdParam,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import { todoUpdateRequestSchema } from "@/lib/api/schemas/request-schemas";
import { requireAuth } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { observedApiRoute } from "@/lib/log/api-observability";
import { parseDateInput } from "@/lib/time/parse-date-input";

export const dynamic = "force-dynamic";

/**
 * Update one todo.
 * @pathParams resourceIdPathParamsSchema
 * @body todoUpdateRequestSchema
 * @response successResponseSchema
 * @response 400:openApiErrorSchema
 */
async function patchRoute(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = await parseResourceIdParam(params, "todo");
  if (parsed instanceof Response) {
    return parsed;
  }
  const id = parsed;

  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const parsedBody = await parseRouteJsonBody(
    request,
    todoUpdateRequestSchema,
    "Invalid todo update",
  );
  if (parsedBody instanceof Response) {
    return parsedBody;
  }

  const hasDueAt = Object.hasOwn(parsedBody, "dueAt");
  const dueAt = hasDueAt ? parseDateInput(parsedBody.dueAt) : undefined;
  if (hasDueAt && dueAt === undefined) {
    return badRequest("Invalid due date");
  }

  try {
    const todo = await prisma.todo.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!todo) {
      return notFound();
    }

    if (todo.userId !== userId) {
      return forbidden();
    }

    const updates: Prisma.TodoUpdateInput = {};
    if (parsedBody.title !== undefined) updates.title = parsedBody.title;
    if (Object.hasOwn(parsedBody, "content")) {
      updates.content = parsedBody.content?.trim() || null;
    }
    if (parsedBody.priority !== undefined)
      updates.priority = parsedBody.priority;
    if (hasDueAt) updates.dueAt = dueAt;
    if (parsedBody.completed !== undefined)
      updates.completed = parsedBody.completed;

    if (Object.keys(updates).length === 0) {
      return badRequest("No changes");
    }

    await prisma.todo.update({ where: { id }, data: updates });

    return jsonResponse({ success: true });
  } catch (error) {
    return handleRouteError("Failed to update todo", error);
  }
}
export const PATCH = observedApiRoute(patchRoute);

/**
 * Delete one todo.
 * @pathParams resourceIdPathParamsSchema
 * @response successResponseSchema
 * @response 404:openApiErrorSchema
 */
async function deleteRoute(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = await parseResourceIdParam(params, "todo");
  if (parsed instanceof Response) {
    return parsed;
  }
  const id = parsed;

  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  try {
    const todo = await prisma.todo.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!todo) {
      return notFound();
    }

    if (todo.userId !== userId) {
      return forbidden();
    }

    await prisma.todo.delete({ where: { id } });

    return jsonResponse({ success: true });
  } catch (error) {
    return handleRouteError("Failed to delete todo", error);
  }
}
export const DELETE = observedApiRoute(deleteRoute);
