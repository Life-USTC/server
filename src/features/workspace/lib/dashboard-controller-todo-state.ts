import type { TodoItem } from "./dashboard-controller-helpers";
import { replaceTodoById } from "./todos";

export function updateDashboardTodoState(input: {
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

export function deleteDashboardTodoState(input: {
  todo: TodoItem;
  todoItems: TodoItem[];
}) {
  return {
    selectedTodo: null,
    todoItems: input.todoItems.filter((item) => item.id !== input.todo.id),
  };
}
