import { replaceTodoById } from "./todos";
import type { TodoItem } from "./workspace-controller-helpers";

export function updateWorkspaceTodoState(input: {
  editingTodo: TodoItem | null;
  nextTodo: TodoItem;
  selectedTodo: TodoItem | null;
  todoItems: TodoItem[];
}) {
  return {
    editingTodo:
      input.editingTodo?.id === input.nextTodo.id
        ? input.nextTodo
        : input.editingTodo,
    selectedTodo:
      input.selectedTodo?.id === input.nextTodo.id
        ? input.nextTodo
        : input.selectedTodo,
    todoItems: replaceTodoById(input.todoItems, input.nextTodo),
  };
}

export function deleteWorkspaceTodoState(input: {
  todo: TodoItem;
  todoItems: TodoItem[];
}) {
  return {
    selectedTodo: null,
    todoItems: input.todoItems.filter((item) => item.id !== input.todo.id),
  };
}
