import { deleteTodoById, updateTodoCompletion } from "./todos";
import type { TodoItem } from "./workspace-controller-helpers";
import {
  deleteWorkspaceTodoState,
  updateWorkspaceTodoState,
} from "./workspace-controller-todo-state";

type TodoActionsCopy = {
  saveFailed: string;
  delete: string;
  markComplete: string;
  markIncomplete: string;
};

export function createWorkspaceTodoActions(input: {
  getEditingTodo: () => TodoItem | null;
  getSelectedTodo: () => TodoItem | null;
  getTodoItems: () => TodoItem[];
  getTodoSavingById: () => Record<string, boolean>;
  getTodosCopy: () => TodoActionsCopy;
  onSuccess?: (action: "complete" | "uncomplete" | "delete") => void;
  setEditingTodo: (value: TodoItem | null) => void;
  setSelectedTodo: (value: TodoItem | null) => void;
  setTodoActionError: (value: string) => void;
  setTodoItems: (value: TodoItem[]) => void;
  setTodoSavingById: (value: Record<string, boolean>) => void;
}) {
  function setTodoSaving(todoId: string, saving: boolean) {
    input.setTodoSavingById({
      ...input.getTodoSavingById(),
      [todoId]: saving,
    });
  }

  function updateLocalTodo(nextTodo: TodoItem) {
    const next = updateWorkspaceTodoState({
      editingTodo: input.getEditingTodo(),
      nextTodo,
      selectedTodo: input.getSelectedTodo(),
      todoItems: input.getTodoItems(),
    });
    input.setTodoItems(next.todoItems);
    input.setSelectedTodo(next.selectedTodo);
    input.setEditingTodo(next.editingTodo);
  }

  async function toggleTodoCompletion(todo: TodoItem) {
    if (input.getTodoSavingById()[todo.id]) return;
    const nextTodo = { ...todo, completed: !todo.completed };
    input.setTodoActionError("");
    setTodoSaving(todo.id, true);
    updateLocalTodo(nextTodo);
    try {
      await updateTodoCompletion({
        completed: nextTodo.completed,
        fallbackMessage: input.getTodosCopy().saveFailed,
        todoId: todo.id,
      });
      input.onSuccess?.(nextTodo.completed ? "complete" : "uncomplete");
    } catch (error) {
      updateLocalTodo(todo);
      input.setTodoActionError(
        error instanceof Error
          ? error.message
          : input.getTodosCopy().saveFailed,
      );
    } finally {
      setTodoSaving(todo.id, false);
    }
  }

  async function deleteTodo(todo: TodoItem) {
    if (input.getTodoSavingById()[todo.id]) return;
    const previousItems = input.getTodoItems();
    input.setTodoActionError("");
    setTodoSaving(todo.id, true);
    const next = deleteWorkspaceTodoState({
      todo,
      todoItems: input.getTodoItems(),
    });
    input.setTodoItems(next.todoItems);
    input.setSelectedTodo(next.selectedTodo);
    try {
      await deleteTodoById({
        fallbackMessage: input.getTodosCopy().saveFailed,
        todoId: todo.id,
      });
      input.onSuccess?.("delete");
    } catch (error) {
      input.setTodoItems(previousItems);
      input.setSelectedTodo(todo);
      input.setTodoActionError(
        error instanceof Error
          ? error.message
          : input.getTodosCopy().saveFailed,
      );
    } finally {
      setTodoSaving(todo.id, false);
    }
  }

  return {
    deleteTodo,
    toggleTodoCompletion,
  };
}
