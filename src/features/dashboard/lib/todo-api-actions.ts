import { readApiErrorMessage } from "@/lib/api/client";

export const todoResponseMessage = readApiErrorMessage;

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
