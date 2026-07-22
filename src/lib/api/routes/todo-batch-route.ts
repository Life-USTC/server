import {
  deleteTodosBatch,
  setTodoCompletionsBatch,
} from "@/features/todos/server/todo-batch-service";
import {
  handleRouteError,
  jsonResponse,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import {
  todoBatchDeleteRequestSchema,
  todoCompletionBatchRequestSchema,
} from "@/lib/api/schemas/request-schemas";
import {
  todoBatchDeleteResponseSchema,
  todoCompletionBatchResponseSchema,
} from "@/lib/api/schemas/response-schemas";
import { requireAuth } from "@/lib/auth/api-auth";
import { serializeDatesDeep } from "@/lib/time/serialize-date-output";

export async function patchTodoBatchRoute(request: Request) {
  const auth = await requireAuth(request, {
    bearerScope: { feature: "todo", action: "write" },
    rateLimit: { action: "todo:batch-write", tier: "batch" },
  });
  if (auth instanceof Response) return auth;

  const body = await parseRouteJsonBody(
    request,
    todoCompletionBatchRequestSchema,
    "Invalid batch payload",
  );
  if (body instanceof Response) return body;

  try {
    const results = await setTodoCompletionsBatch(auth.userId, body.items);

    return jsonResponse(
      todoCompletionBatchResponseSchema.parse(serializeDatesDeep({ results })),
    );
  } catch (error) {
    return handleRouteError("Failed to update todo batch", error);
  }
}

export async function deleteTodoBatchRoute(request: Request) {
  const auth = await requireAuth(request, {
    bearerScope: { feature: "todo", action: "write" },
    rateLimit: { action: "todo:batch-write", tier: "batch" },
  });
  if (auth instanceof Response) return auth;

  const body = await parseRouteJsonBody(
    request,
    todoBatchDeleteRequestSchema,
    "Invalid batch payload",
  );
  if (body instanceof Response) return body;

  try {
    const results = await deleteTodosBatch(auth.userId, body.ids);

    return jsonResponse(todoBatchDeleteResponseSchema.parse({ results }));
  } catch (error) {
    return handleRouteError("Failed to delete todo batch", error);
  }
}
