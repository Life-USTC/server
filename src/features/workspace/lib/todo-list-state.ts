type TodoFilter = "incomplete" | "completed" | "all";

type TodoFilterState = {
  completed: boolean;
};

export function filterTodos<Todo extends TodoFilterState>(
  todos: Todo[],
  filter: TodoFilter,
) {
  return todos.filter((todo) => {
    if (filter === "all") return true;
    return filter === "completed" ? todo.completed : !todo.completed;
  });
}

export function replaceTodoById<Todo extends { id: string | number }>(
  todos: Todo[],
  nextTodo: Todo,
) {
  return todos.map((todo) => (todo.id === nextTodo.id ? nextTodo : todo));
}
