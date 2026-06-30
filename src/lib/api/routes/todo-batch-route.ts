import { updateOwnedTodo } from "@/features/todos/server/todo-service";
import {
  handleRouteError,
  jsonResponse,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import { todoCompletionBatchRequestSchema } from "@/lib/api/schemas/request-schemas";
import { todoCompletionBatchResponseSchema } from "@/lib/api/schemas/response-schemas";
import { requireAuth } from "@/lib/auth/api-auth";
import { serializeDatesDeep } from "@/lib/time/serialize-date-output";

export async function patchTodoBatchRoute(request: Request) {
  const auth = await requireAuth(request, {
    bearerScope: { feature: "todo", action: "write" },
  });
  if (auth instanceof Response) return auth;

  const body = await parseRouteJsonBody(
    request,
    todoCompletionBatchRequestSchema,
    "Invalid batch payload",
  );
  if (body instanceof Response) return body;

  try {
    const results = await Promise.all(
      body.items.map(async (item) => {
        const result = await updateOwnedTodo({
          id: item.todoId,
          userId: auth.userId,
          data: { completed: item.completed, dueAt: undefined, hasDueAt: false },
        });
        if (!result.ok) {
          return {
            success: false as const,
            todoId: item.todoId,
            completed: item.completed,
            error: { code: result.error, message: result.error },
          };
        }
        return {
          success: true as const,
          todoId: item.todoId,
          completed: item.completed,
          todo: result.todo,
        };
      }),
    );

    return jsonResponse(
      todoCompletionBatchResponseSchema.parse(serializeDatesDeep({ results })),
    );
  } catch (error) {
    return handleRouteError("Failed to update todo batch", error);
  }
}
