import { apiClient, apiErrorMessage } from "@/lib/api/client";

export async function updateTodoCompletion(input: {
  completed: boolean;
  fallbackMessage: string;
  todoId: number | string;
}) {
  const result = await apiClient.PATCH(`/api/workspace/todos/${input.todoId}`, {
    body: { completed: input.completed },
  });
  if (!result.response.ok) {
    throw new Error(apiErrorMessage(result.error, input.fallbackMessage));
  }
}

export async function deleteTodoById(input: {
  fallbackMessage: string;
  todoId: number | string;
}) {
  const result = await apiClient.DELETE(`/api/workspace/todos/${input.todoId}`);
  if (!result.response.ok) {
    throw new Error(apiErrorMessage(result.error, input.fallbackMessage));
  }
}
