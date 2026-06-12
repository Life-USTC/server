export async function todoResponseMessage(
  response: Response,
  fallback: string,
) {
  try {
    const body = (await response.json()) as {
      message?: unknown;
      error?: { message?: unknown } | string;
    };
    if (typeof body.message === "string" && body.message.trim()) {
      return body.message;
    }
    if (typeof body.error === "string" && body.error.trim()) {
      return body.error;
    }
    if (
      body.error &&
      typeof body.error === "object" &&
      typeof body.error.message === "string" &&
      body.error.message.trim()
    ) {
      return body.error.message;
    }
  } catch {
    // Keep the UI fallback when the API returns a non-JSON error body.
  }
  return fallback;
}

export async function updateTodoCompletion(input: {
  completed: boolean;
  fallbackMessage: string;
  todoId: number | string;
}) {
  const response = await fetch(`/api/todos/${input.todoId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ completed: input.completed }),
  });
  if (!response.ok) {
    throw new Error(await todoResponseMessage(response, input.fallbackMessage));
  }
}

export async function deleteTodoById(input: {
  fallbackMessage: string;
  todoId: number | string;
}) {
  const response = await fetch(`/api/todos/${input.todoId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(await todoResponseMessage(response, input.fallbackMessage));
  }
}
