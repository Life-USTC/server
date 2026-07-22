import { mapTodoBatchWithConcurrency } from "../lib/todo-batch-concurrency";
import { deleteOwnedTodo, updateOwnedTodo } from "./todo-service";

export function setTodoCompletionsBatch(
  userId: string,
  items: readonly { completed: boolean; todoId: string }[],
) {
  return mapTodoBatchWithConcurrency(items, async (item) => {
    const result = await updateOwnedTodo({
      id: item.todoId,
      userId,
      data: {
        completed: item.completed,
        dueAt: undefined,
        hasDueAt: false,
      },
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
  });
}

export function deleteTodosBatch(userId: string, ids: readonly string[]) {
  return mapTodoBatchWithConcurrency(ids, async (id) => {
    const result = await deleteOwnedTodo(id, userId);
    return result.ok
      ? { success: true as const, id }
      : {
          success: false as const,
          id,
          error: { code: result.error, message: result.error },
        };
  });
}
